/**
 * SSRF-resistant fetch wrapper.
 *
 * Anywhere user-supplied URLs are fetched on the server (webhook delivery,
 * knowledge-base URL scraping, future imports), route them through here.
 * Plain `fetch(userUrl)` lets a hostile member point at the Vercel/AWS
 * metadata service, internal LB IPs, or localhost.
 *
 * Strategy:
 *   1. Reject non-https schemes outright.
 *   2. Reject hostnames that resolve to private / loopback / link-local /
 *      metadata IPs in BOTH IPv4 and IPv6.
 *   3. Re-resolve and re-check after every redirect (handles external→internal
 *      redirect chains).
 *   4. PIN the validated IP for the actual TCP connect via a custom undici
 *      Agent so the kernel does not re-resolve the hostname a second time.
 *      Without this, a hostile DNS server can return a public IP for the
 *      validation lookup and a private IP for the connect lookup (the classic
 *      DNS-rebinding TOCTOU). TLS still validates the cert against the
 *      original hostname (SNI is preserved), so cert pinning is unaffected.
 *   5. Hard-cap response size and request timeout.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export type SafeFetchOptions = {
  method?:        "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?:       Record<string, string>;
  body?:          string;
  timeoutMs?:     number;
  maxBytes?:      number;
  maxRedirects?:  number;
};

export type SafeFetchResult =
  | { ok: true;  status: number; bodyText: string; finalUrl: string }
  | { ok: false; reason: string; status?: number };

const DEFAULT_TIMEOUT  = 8_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_REDIRECTS = 3;

/** True if the IPv4 falls in a private / reserved / metadata range. */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  // 0.0.0.0/8, 10/8, 127/8, 169.254/16 (link-local + AWS metadata),
  // 172.16/12, 192.168/16, 100.64/10 (CGNAT), 224/4 (multicast), 240/4 (reserved)
  if (a === 0)                                return true;
  if (a === 10)                               return true;
  if (a === 127)                              return true;
  if (a === 169 && b === 254)                 return true;
  if (a === 172 && b >= 16 && b <= 31)        return true;
  if (a === 192 && b === 168)                 return true;
  if (a === 100 && b >= 64 && b <= 127)       return true;
  if (a >= 224)                               return true;
  return false;
}

/** True if the IPv6 is loopback / link-local / unique-local / mapped-IPv4. */
function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:"))         return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  // ::ffff:a.b.c.d — IPv4-mapped, re-check as IPv4
  const v4MappedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedMatch) return isBlockedIPv4(v4MappedMatch[1]);
  return false;
}

type HostCheck =
  | { ok: false; reason: string }
  | { ok: true;  pinnedIp: string; family: 4 | 6 };

async function isHostBlocked(hostname: string): Promise<HostCheck> {
  // Reject obviously suspect names without DNS.
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost"))     return { ok: false, reason: "localhost" };
  if (lower === "metadata.google.internal")                       return { ok: false, reason: "gcp metadata" };
  if (lower === "metadata.aws.internal")                          return { ok: false, reason: "aws metadata" };
  if (lower.endsWith(".internal") || lower.endsWith(".local"))    return { ok: false, reason: "internal tld" };

  // Literal IP — check directly. Pin to itself.
  const ipKind = isIP(hostname);
  if (ipKind === 4) {
    if (isBlockedIPv4(hostname)) return { ok: false, reason: `blocked ipv4 ${hostname}` };
    return { ok: true, pinnedIp: hostname, family: 4 };
  }
  if (ipKind === 6) {
    if (isBlockedIPv6(hostname)) return { ok: false, reason: `blocked ipv6 ${hostname}` };
    return { ok: true, pinnedIp: hostname, family: 6 };
  }

  // Resolve and check every record. Both A and AAAA so a host with one good
  // record + one bad record fails closed. Pin the first non-blocked address
  // so the kernel connect() uses the IP we just validated — no rebinding.
  let firstGood: { address: string; family: 4 | 6 } | null = null;
  try {
    const addrs = await lookup(hostname, { all: true });
    for (const { address, family } of addrs) {
      if (family === 4 && isBlockedIPv4(address)) return { ok: false, reason: `host ${hostname} resolved to private ipv4 ${address}` };
      if (family === 6 && isBlockedIPv6(address)) return { ok: false, reason: `host ${hostname} resolved to private ipv6 ${address}` };
      if (!firstGood && (family === 4 || family === 6)) {
        firstGood = { address, family: family as 4 | 6 };
      }
    }
  } catch (e) {
    return { ok: false, reason: `dns lookup failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!firstGood) return { ok: false, reason: `no usable address for ${hostname}` };
  return { ok: true, pinnedIp: firstGood.address, family: firstGood.family };
}

/** Read a response body with a hard byte cap so a hostile target can't OOM us. */
async function readBodyCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Error(`response_too_large (>${maxBytes} bytes)`);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

/**
 * Build an undici Agent that forces TCP connect to the pinned IP. The
 * hostname in the URL (and therefore TLS SNI + cert validation) is still
 * the original — we are only short-circuiting the kernel's DNS lookup so
 * a hostile resolver cannot swap in a private IP between our validation
 * lookup and the actual connect.
 */
function buildPinnedAgent(pinnedIp: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, _opts, cb) => cb(null, pinnedIp, family),
    },
  });
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs    = opts.timeoutMs    ?? DEFAULT_TIMEOUT;
  const maxBytes     = opts.maxBytes     ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsed: URL;
    try { parsed = new URL(currentUrl); }
    catch { return { ok: false, reason: "invalid_url" }; }

    if (parsed.protocol !== "https:") {
      return { ok: false, reason: "scheme_not_allowed" };
    }
    const check = await isHostBlocked(parsed.hostname);
    if (!check.ok) return { ok: false, reason: `host_blocked: ${check.reason}` };

    // Pin the validated IP for the actual TCP connect. A fresh Agent per
    // request avoids leaking the pinned lookup into anything else and gets
    // closed before the function returns to release the socket.
    const pinnedAgent = buildPinnedAgent(check.pinnedIp, check.family);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      res = await undiciFetch(currentUrl, {
        method:     opts.method  ?? "GET",
        headers:    opts.headers ?? {},
        body:       opts.body,
        redirect:   "manual",
        signal:     ctl.signal,
        dispatcher: pinnedAgent,
      });
    } catch (e) {
      clearTimeout(timer);
      pinnedAgent.close().catch(() => {});
      return { ok: false, reason: `network: ${e instanceof Error ? e.message : String(e)}` };
    }
    clearTimeout(timer);

    // Follow redirect manually so we can re-validate the new host with a
    // fresh DNS lookup + a fresh pin for the next hop.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      pinnedAgent.close().catch(() => {});
      if (!loc) return { ok: false, reason: "redirect_without_location" };
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    let bodyText = "";
    try { bodyText = await readBodyCapped(res.body as ReadableStream<Uint8Array> | null, maxBytes); }
    catch (e) {
      pinnedAgent.close().catch(() => {});
      return { ok: false, reason: e instanceof Error ? e.message : String(e), status: res.status };
    }
    pinnedAgent.close().catch(() => {});

    return { ok: true, status: res.status, bodyText, finalUrl: currentUrl };
  }
  return { ok: false, reason: "too_many_redirects" };
}
