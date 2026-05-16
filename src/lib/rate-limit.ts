/**
 * In-memory rate limiter — token bucket style.
 *
 * Caveats:
 *   - State is per Node.js process. Vercel serverless lambdas may spin up
 *     new instances; an attacker hitting different lambda instances can
 *     temporarily exceed the limit. This is acceptable for our threat model:
 *     we want to dampen abuse, not implement strict DDoS protection.
 *   - For strict global limits, migrate to Vercel KV / Upstash Redis.
 *
 * Usage:
 *   const ok = rateLimit("ai:" + orgId, { capacity: 60, refillPerSec: 1 });
 *   if (!ok) return 429;
 */

type Bucket = {
  tokens: number;
  lastRefill: number; // ms epoch
};

const BUCKETS = new Map<string, Bucket>();

/** Cap on map size to avoid unbounded growth in long-lived processes. */
const MAX_BUCKETS = 10_000;

export type RateLimitOptions = {
  /** Max bucket size (burst capacity) */
  capacity: number;
  /** Tokens refilled per second */
  refillPerSec: number;
};

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Atomically deducts one token on success.
 */
export function rateLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();

  // Lazy GC — when full, drop oldest entries
  if (BUCKETS.size >= MAX_BUCKETS) {
    const toDrop = Math.floor(MAX_BUCKETS / 10);
    const keys = Array.from(BUCKETS.keys()).slice(0, toDrop);
    for (const k of keys) BUCKETS.delete(k);
  }

  const existing = BUCKETS.get(key);
  if (!existing) {
    BUCKETS.set(key, { tokens: opts.capacity - 1, lastRefill: now });
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - existing.lastRefill) / 1000;
  existing.tokens = Math.min(opts.capacity, existing.tokens + elapsed * opts.refillPerSec);
  existing.lastRefill = now;

  if (existing.tokens >= 1) {
    existing.tokens -= 1;
    return true;
  }
  return false;
}

/** Common rate-limit presets — single source of truth per route family. */
export const RATE_LIMITS = {
  /** AI draft generation — 60 per minute per org */
  aiDraft:        { capacity: 60,  refillPerSec: 1 },
  /** Invite sending — 10 per hour per org */
  invite:         { capacity: 10,  refillPerSec: 10 / 3600 },
  /** Inbound webhook — 600 per minute per inbox (~10/sec) */
  inboundWebhook: { capacity: 600, refillPerSec: 10 },
  /** Push subscribe — 20 per minute per user */
  pushSubscribe:  { capacity: 20,  refillPerSec: 20 / 60 },
} as const;
