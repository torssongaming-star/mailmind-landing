/**
 * Locked OAuth token refresh for inboxes.
 *
 * Without a lock, concurrent webhooks for the same inbox (Pub/Sub burst,
 * webhook + cron renewal racing, retry after timeout) all decrypt the same
 * stale tokens and all call the provider's /token endpoint with the same
 * refresh_token. Best case: wasted API calls + rate-limit consumption. Worst
 * case: one of the responses gets rotated out by Google/Microsoft and the
 * inbox loses its refresh_token entirely.
 *
 * Mitigation: per-inbox Redis lock + double-checked locking pattern.
 *
 *   1. Fast path: if the in-memory tokens are still valid, return without
 *      touching Redis or the DB.
 *   2. Slow path: acquire `token-refresh:<inboxId>` lock (TTL 30 s).
 *   3. After acquiring, RE-READ the inbox row from DB — another worker
 *      may have already refreshed and stored fresh tokens.
 *   4. Double-check: if the re-read tokens are valid, return them.
 *   5. Otherwise, perform the refresh, persist via updateInboxConfig,
 *      and return. Lock auto-releases on the function's `finally`.
 *
 * The lock falls back to in-memory when UPSTASH_REDIS_REST_* are unset
 * (single-process protection only — production MUST run with Redis).
 */

import { eq } from "drizzle-orm";
import { db, inboxes } from "@/lib/db";
import { updateInboxConfig } from "./threads";
import { withLock } from "@/lib/redis-lock";

const LOCK_TTL_MS  = 30_000; // worst-case refresh round-trip
const LOCK_WAIT_MS = 25_000; // less than TTL so we never deadlock on a stuck holder
const REFRESH_SAFETY_MARGIN_MS = 60_000; // refresh 60 s before expiry

/** Shape any token bag must have so we can decide validity. */
type TokensLike = { accessToken: string; expiresAt: number };

/** Provider-specific hooks supplied by the caller. */
type RefreshHooks<TTokens extends TokensLike> = {
  /** Decrypt the encryptedTokens string into a TTokens object. */
  decrypt: (encrypted: string) => TTokens;
  /** Encrypt tokens for storage in inbox.config.encryptedTokens. */
  encrypt: (tokens: TTokens) => string;
  /** Provider call — exchange refresh_token for a new access_token. */
  refresh: (tokens: TTokens) => Promise<TTokens>;
  /** Optional expiry check override (default: 60 s before expiresAt). */
  isExpired?: (tokens: TTokens) => boolean;
};

/**
 * Returns a valid access token for the given inbox, refreshing under a
 * per-inbox distributed lock if necessary. The returned `tokens` may differ
 * from what was passed in — callers should use them for any subsequent
 * encryption (e.g. when also rewriting unrelated fields in inbox.config).
 *
 * Persistence to inbox.config happens BEFORE the function returns; callers
 * do not need to call updateInboxConfig again unless they're modifying
 * other config fields in the same transaction.
 */
export async function getValidAccessTokenLocked<
  TConfig extends { encryptedTokens: string },
  TTokens extends TokensLike,
>(
  inboxId: string,
  currentConfig: TConfig,
  hooks: RefreshHooks<TTokens>,
): Promise<{ accessToken: string; tokens: TTokens; refreshed: boolean }> {
  const isExpired =
    hooks.isExpired ??
    ((t: TTokens) => Date.now() >= t.expiresAt - REFRESH_SAFETY_MARGIN_MS);

  const tokens = hooks.decrypt(currentConfig.encryptedTokens);

  // Fast path — token still valid, no lock + no DB round-trip.
  if (!isExpired(tokens)) {
    return { accessToken: tokens.accessToken, tokens, refreshed: false };
  }

  return withLock(
    `token-refresh:${inboxId}`,
    LOCK_TTL_MS,
    async () => {
      // ── Double-checked locking ─────────────────────────────────────────────
      // Re-read inbox config from DB — another worker may have refreshed
      // while we were waiting for the lock.
      const rows = await db
        .select({ config: inboxes.config })
        .from(inboxes)
        .where(eq(inboxes.id, inboxId))
        .limit(1);

      const freshConfig = (rows[0]?.config ?? currentConfig) as TConfig;
      const freshTokens = hooks.decrypt(freshConfig.encryptedTokens);

      if (!isExpired(freshTokens)) {
        // Another worker just did the work for us.
        return { accessToken: freshTokens.accessToken, tokens: freshTokens, refreshed: false };
      }

      // Still expired — we own the lock, so we do the refresh.
      const newTokens = await hooks.refresh(freshTokens);

      // Persist — preserve any unrelated keys in config (subscriptionId, historyId, ...).
      await updateInboxConfig(inboxId, {
        ...freshConfig,
        encryptedTokens: hooks.encrypt(newTokens),
      } as Record<string, unknown>);

      return { accessToken: newTokens.accessToken, tokens: newTokens, refreshed: true };
    },
    LOCK_WAIT_MS,
  );
}
