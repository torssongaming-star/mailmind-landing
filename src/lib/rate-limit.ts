/**
 * Distributed rate limiter backed by Upstash Redis (sliding window).
 *
 * When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set the
 * module falls back to the original in-memory token-bucket so local dev and
 * test suites work without a Redis instance.
 *
 * Usage (unchanged from the in-memory version):
 *   const ok = await rateLimit("ai:" + orgId, RATE_LIMITS.aiDraft);
 *   if (!ok) return 429;
 */

import type { Duration } from "@upstash/ratelimit";

export type RateLimitOptions = {
  /** Max burst capacity */
  capacity: number;
  /** Tokens refilled per second (steady-state rate) */
  refillPerSec: number;
};

// ── Upstash Redis client (lazy, singleton) ────────────────────────────────────

let _redis: import("@upstash/redis").Redis | null = null;
let _redisChecked = false;

function getRedis(): import("@upstash/redis").Redis | null {
  if (_redisChecked) return _redis;
  _redisChecked = true;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  _redis = new Redis({ url, token });
  return _redis;
}

// ── Ratelimit instance cache (one per unique capacity+window combo) ────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _limiterCache = new Map<string, any>();

function getLimiter(opts: RateLimitOptions) {
  const redis = getRedis()!;
  // Derive sliding window duration from token-bucket params:
  //   window = capacity / refillPerSec  (seconds)
  const windowSecs = opts.refillPerSec > 0
    ? Math.max(1, Math.round(opts.capacity / opts.refillPerSec))
    : 1;
  const fingerprint = `${opts.capacity}:${windowSecs}`;

  let limiter = _limiterCache.get(fingerprint);
  if (!limiter) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Ratelimit } = require("@upstash/ratelimit") as typeof import("@upstash/ratelimit");
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(opts.capacity, `${windowSecs} s` as Duration),
      prefix:  "mm:rl",
      analytics: false,
    });
    _limiterCache.set(fingerprint, limiter);
  }
  return limiter as import("@upstash/ratelimit").Ratelimit;
}

// ── In-memory token-bucket fallback ───────────────────────────────────────────

type Bucket = { tokens: number; lastRefill: number };
const _buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function _inMemoryLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  if (_buckets.size >= MAX_BUCKETS) {
    const toDrop = Math.floor(MAX_BUCKETS / 10);
    const keys = Array.from(_buckets.keys()).slice(0, toDrop);
    for (const k of keys) _buckets.delete(k);
  }
  const existing = _buckets.get(key);
  if (!existing) {
    _buckets.set(key, { tokens: opts.capacity - 1, lastRefill: now });
    return true;
  }
  const elapsed = (now - existing.lastRefill) / 1000;
  existing.tokens = Math.min(opts.capacity, existing.tokens + elapsed * opts.refillPerSec);
  existing.lastRefill = now;
  if (existing.tokens >= 1) {
    existing.tokens -= 1;
    return true;
  }
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Uses Upstash Redis when configured; falls back to in-memory token bucket.
 */
export async function rateLimit(key: string, opts: RateLimitOptions): Promise<boolean> {
  if (!getRedis()) {
    return _inMemoryLimit(key, opts);
  }
  try {
    const { success } = await getLimiter(opts).limit(key);
    return success;
  } catch (err) {
    // Redis unavailable — fail open so a Redis outage doesn't take down the app
    console.error("[rate-limit] Redis error, failing open:", err);
    return true;
  }
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
  /** Stripe checkout creation — 5 per minute per user (DoS guard on Stripe API) */
  checkout:       { capacity: 5,   refillPerSec: 5 / 60 },
} as const;