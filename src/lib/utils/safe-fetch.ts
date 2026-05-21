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
 *   3. Re-resolve and re-check after every redirect (handles DNS-rebinding
 *      and external→internal redirect chains).
 *   4. Hard-cap response size and request timeout.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

async function isHostBlocked(hostname: string): Promise<string | null> {
  // Reject obviously suspect names without DNS.
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost"))     return "localhost";
  if (lower === "metadata.google.internal")                       return "gcp metadata";
  if (lower === "metadata.aws.internal")                          return "aws metadata";
  if (lower.endsWith(".internal") || lower.endsWith(".local"))    return "internal tld";

  // Literal IP — check directly.
  const ipKind = isIP(hostname);
  if (ipKind === 4) return isBlockedIPv4(hostname)  ? `blocked ipv4 ${hostname}` : null;
  if (ipKind === 6) return isBlockedIPv6(hostname)  ? `blocked ipv6 ${hostname}` : null;

  // Resolve and check every record. Both A and AAAA so a host with one good
  // record + one bad record fails closed.
  try {
    const addrs = await lookup(hostname, { all: true });
    for (const { address, family } of addrs) {
      if (family === 4 && isBlockedIPv4(address)) return `host ${hostname} resolved to private ipv4 ${address}`;
      if (family === 6 && isBlockedIPv6(address)) return `host ${hostname} resolved to private ipv6 ${address}`;
    }
  } catch (e) {
    return `dns lookup failed: ${e instanceof Error ? e.message : String(e)}`;
  }
  return null;
}

/** Read a response body with a hard byte cap so a hostile target can't OOM us. */
async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
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
    const blocked = await isHostBlocked(parsed.hostname);
    if (blocked) return { ok: false, reason: `host_blocked: ${blocked}` };

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method:   opts.method  ?? "GET",
        headers:  opts.headers ?? {},
        body:     opts.body,
        redirect: "manual",
        signal:   ctl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, reason: `network: ${e instanceof Error ? e.message : String(e)}` };
    }
    clearTimeout(timer);

    // Follow redirect manually so we can re-validate the new host.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: "redirect_without_location" };
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    let bodyText = "";
    try { bodyText = await readBodyCapped(res, maxBytes); }
    catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e), status: res.status }; }

    return { ok: true, status: res.status, bodyText, finalUrl: currentUrl };
  }
  return { ok: false, reason: "too_many_redirects" };
}
