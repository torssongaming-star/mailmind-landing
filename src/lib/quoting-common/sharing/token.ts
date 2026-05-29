/**
 * Quote share tokens — stateless, capability-based access for customers.
 *
 * A share token is a signed bearer capability that lets an unauthenticated
 * customer view and accept a specific quote, without a login or a DB table.
 * The token IS the authorisation: possession of a valid token for quote X
 * grants access to quote X and nothing else.
 *
 * Format:  base64url("<orgId>:<quoteId>") "." base64url(HMAC-SHA256(payload, secret))
 *
 * The payload embeds BOTH the org id and the quote id. This means the public
 * flow never needs an org-unscoped DB lookup: the (trusted, post-HMAC) orgId
 * is fed straight into the normal org-scoped data layer — no boundary hole.
 *
 * Security properties:
 *   - HMAC over "<orgId>:<quoteId>" — token cannot be forged without the
 *     server secret (QUOTE_SHARE_SECRET).
 *   - Timing-safe comparison on verify.
 *   - No DB lookup needed to validate the signature.
 *   - If QUOTE_SHARE_SECRET is unset the feature is disabled: createShareToken
 *     throws, verifyShareToken returns null (fail-safe).
 *
 * Note: tokens do not expire on their own — quote validity is enforced
 * separately via status (expired/rejected reject acceptance) and validUntil.
 * Rotating QUOTE_SHARE_SECRET invalidates all outstanding tokens.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type ShareTokenClaims = { orgId: string; quoteId: string };

function getSecret(): string | null {
  return process.env.QUOTE_SHARE_SECRET || null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Create a share token binding orgId + quoteId. Throws if QUOTE_SHARE_SECRET
 * is unset — callers should treat that as "sharing not configured".
 */
export function createShareToken(orgId: string, quoteId: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("QUOTE_SHARE_SECRET is not set");
  const claim   = `${orgId}:${quoteId}`;
  const payload = b64url(Buffer.from(claim, "utf8"));
  const sig     = b64url(sign(claim, secret));
  return `${payload}.${sig}`;
}

/**
 * Verify a share token and return its claims ({ orgId, quoteId }), or null if
 * the token is malformed, tampered, or the feature is disabled.
 */
export function verifyShareToken(token: string): ShareTokenClaims | null {
  const secret = getSecret();
  if (!secret) return null;
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  let claim: string;
  try {
    claim = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(claim, secret);

  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  // Only parse the claim after the HMAC checks out.
  const sep = claim.indexOf(":");
  if (sep <= 0 || sep === claim.length - 1) return null;
  const orgId   = claim.slice(0, sep);
  const quoteId = claim.slice(sep + 1);
  if (!orgId || !quoteId) return null;

  return { orgId, quoteId };
}

/** True when the share feature is configured. */
export function isShareConfigured(): boolean {
  return getSecret() !== null;
}
