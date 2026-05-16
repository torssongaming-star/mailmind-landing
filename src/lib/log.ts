/**
 * Structured logger with PII masking.
 *
 * Wraps console.* so we can:
 *   1. Mask emails / tokens / UUIDs in logs before they hit Sentry/Vercel logs
 *   2. Standardise log levels (info/warn/error)
 *   3. Add a route prefix automatically
 *
 * Usage:
 *   const log = createLogger("microsoft/notifications");
 *   log.info("new message", { from: "kund@bolag.se" });
 *   // → [microsoft/notifications] new message { from: "k***@bolag.se" }
 */

const EMAIL_RE = /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const UUID_RE  = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-+/=]+/g;
const LONG_HEX_RE = /\b[a-f0-9]{32,}\b/gi;

function maskString(s: string): string {
  return s
    .replace(EMAIL_RE, "$1***$2")
    .replace(BEARER_RE, "Bearer ***")
    .replace(UUID_RE, m => `${m.slice(0, 4)}…${m.slice(-4)}`)
    .replace(LONG_HEX_RE, m => `${m.slice(0, 6)}…[${m.length}c]`);
}

function maskValue(v: unknown): unknown {
  if (typeof v === "string") return maskString(v);
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(maskValue);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    // Redact obvious secrets entirely
    if (/password|secret|token|api[-_]?key|cookie|authorization/i.test(k)) {
      out[k] = "***";
    } else {
      out[k] = maskValue(val);
    }
  }
  return out;
}

type LogContext = Record<string, unknown> | undefined;

export type Logger = {
  info:  (msg: string, ctx?: LogContext) => void;
  warn:  (msg: string, ctx?: LogContext) => void;
  error: (msg: string, ctx?: LogContext) => void;
};

export function createLogger(prefix: string): Logger {
  const tag = `[${prefix}]`;
  return {
    info:  (msg, ctx) => console.log (tag, maskString(msg), ctx ? maskValue(ctx) : ""),
    warn:  (msg, ctx) => console.warn(tag, maskString(msg), ctx ? maskValue(ctx) : ""),
    error: (msg, ctx) => console.error(tag, maskString(msg), ctx ? maskValue(ctx) : ""),
  };
}
