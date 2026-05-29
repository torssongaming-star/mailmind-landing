/**
 * Quote share tokens — stateless, capability-based access for customers.
 *
 * A share token is a signed bearer capability that lets an unauthenticated
 * customer view and accept a specific quote, without a login or a DB table.
 * The token IS the authorisation: possession of a valid token for quote X
 * grants access to quote X and nothing else.
 *
 * Format:  base64url(quoteId) "." base64url(HMAC-SHA256(quoteId, secret))
 *
 * Security properties:
 *   - HMAC over the quoteId means the token cannot be forged without the
 *     server secret (QUOTE_SHARE_SECRET).
 *   - Timing-safe comparison on verify.
 *   - No DB lookup needed to validate the signature — the quoteId is only
 *     trusted after the HMAC checks out.
 *   - If QUOTE_SHARE_SECRET is unset the feature is disabled: createShareToken
 *     throws, verifyShareToken returns null (fail-safe).
 *
 * Note: tokens do not expire on their own — quote validity is enforced
 * separately via the quote's status (expired quotes reject acceptance) and
 * the validUntil date. Rotating QUOTE_SHARE_SECRET invalidates all tokens.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string | null {
  return process.env.QUOTE_SHARE_SECRET || null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(quoteId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(quoteId).digest();
}

/**
 * Create a share token for a quote. Throws if QUOTE_SHARE_SECRET is unset —
 * callers should treat that as "sharing not configured" and skip the link.
 */
export function createShareToken(quoteId: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("QUOTE_SHARE_SECRET is not set");
  const payload = b64url(Buffer.from(quoteId, "utf8"));
  const sig     = b64url(sign(quoteId, secret));
  return `${payload}.${sig}`;
}

/**
 * Verify a share token and return the quoteId it authorises, or null if the
 * token is malformed, tampered, or the feature is disabled.
 */
export function verifyShareToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  let quoteId: string;
  try {
    quoteId = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!quoteId) return null;

  const expected = sign(quoteId, secret);

  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  return quoteId;
}

/** True when the share feature is configured. */
export function isShareConfigured(): boolean {
  return getSecret() !== null;
}
