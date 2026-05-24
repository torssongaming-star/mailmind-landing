/**
 * Distributed mutual-exclusion lock backed by Upstash Redis.
 *
 * Use when concurrent workers (Pub/Sub deliveries, webhooks, cron firings)
 * may race on the same resource and we need at-most-one execution per key.
 * Current primary use: serialise OAuth token-refresh per inbox so two
 * webhooks don't both spend the refresh_token at the same time.
 *
 * Falls back to a process-local in-memory map when Redis is not configured
 * so tests and local dev work without an Upstash instance. The fallback only
 * protects within a single Node process — production MUST have Redis.
 *
 * Lock identity: each acquire mints a random token. release() uses Lua
 * compare-and-delete so an expired lock that's been re-acquired by someone
 * else won't be released by the original holder.
 */
import { randomBytes } from "crypto";

// ── Redis client (lazy, singleton) ────────────────────────────────────────────

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

// ── In-memory fallback ────────────────────────────────────────────────────────

type LocalLock = { token: string; expiresAt: number };
const _localLocks = new Map<string, LocalLock>();

function inMemoryAcquire(key: string, ttlMs: number): string | null {
  const existing = _localLocks.get(key);
  if (existing && existing.expiresAt > Date.now()) return null;
  const token = randomBytes(16).toString("hex");
  _localLocks.set(key, { token, expiresAt: Date.now() + ttlMs });
  return token;
}

function inMemoryRelease(key: string, lockToken: string): void {
  const existing = _localLocks.get(key);
  if (existing && existing.token === lockToken) _localLocks.delete(key);
}

// ── Public API ────────────────────────────────────────────────────────────────

const PREFIX = "mm:lock:";

/** SET key value NX PX ttl */
const ACQUIRE_OPTS = (ttlMs: number) => ({ nx: true, px: ttlMs }) as const;

/** Compare-and-delete so we only release a lock we still own. */
const RELEASE_LUA = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;

/**
 * Try once to acquire the lock. Returns a lock token on success (used to
 * release the lock) or null if the lock is held by another caller.
 * The lock auto-releases after ttlMs even if the holder crashes.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const fullKey = PREFIX + key;
  const redis = getRedis();
  if (!redis) return inMemoryAcquire(fullKey, ttlMs);

  const token = randomBytes(16).toString("hex");
  try {
    const result = await redis.set(fullKey, token, ACQUIRE_OPTS(ttlMs));
    return result === "OK" ? token : null;
  } catch (err) {
    // Sentry capture so Redis outages don't silently break token refresh.
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(err, { tags: { component: "redis-lock", op: "acquire", key } });
    } catch { /* ignore */ }
    console.error("[redis-lock] acquire failed:", err);
    return null;
  }
}

/** Release the lock — only if our token still matches what's in Redis. */
export async function releaseLock(key: string, lockToken: string): Promise<void> {
  const fullKey = PREFIX + key;
  const redis = getRedis();
  if (!redis) { inMemoryRelease(fullKey, lockToken); return; }
  try {
    await redis.eval(RELEASE_LUA, [fullKey], [lockToken]);
  } catch (err) {
    // Not fatal — the TTL guarantees eventual release. Log but continue.
    console.warn("[redis-lock] release failed (will auto-expire):", err);
  }
}

/**
 * Poll-and-wait acquire. Returns the lock token once acquired, or null if
 * it couldn't be acquired within waitMs. Default poll interval: 100ms.
 *
 * Use when you'd rather wait briefly than fail — the caller can then re-read
 * shared state (which the lock holder probably just refreshed) and continue.
 */
export async function acquireLockWaiting(
  key: string,
  ttlMs: number,
  waitMs = ttlMs,
  pollIntervalMs = 100,
): Promise<string | null> {
  const deadline = Date.now() + waitMs;
  // First attempt — try immediately
  let token = await acquireLock(key, ttlMs);
  while (!token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    token = await acquireLock(key, ttlMs);
  }
  return token;
}

/**
 * Run fn while holding a distributed lock. Auto-releases on success or
 * exception. Throws if the lock can't be acquired within waitMs.
 *
 * @param key            Lock identifier — prefixed with "mm:lock:" internally.
 * @param ttlMs          Auto-release timeout. Must exceed the worst-case
 *                       runtime of fn or another worker may steal the lock.
 * @param fn             Work to do while holding the lock.
 * @param waitMs         How long to wait trying to acquire (default = ttlMs).
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  waitMs = ttlMs,
): Promise<T> {
  const token = await acquireLockWaiting(key, ttlMs, waitMs);
  if (!token) {
    throw new Error(`Could not acquire lock '${key}' within ${waitMs}ms`);
  }
  try {
    return await fn();
  } finally {
    await releaseLock(key, token);
  }
}
