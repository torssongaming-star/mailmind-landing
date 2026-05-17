/**
 * Google OIDC JWT verifier for Pub/Sub push subscriptions.
 *
 * Strategi-revision P2.4: Google Pub/Sub push endpoints must verify the
 * Authorization: Bearer JWT to confirm the request actually originated from
 * Google, not from a forged caller.
 *
 * Setup (one-time in Google Cloud Console):
 *   - When creating the Push subscription, enable "Enable authentication"
 *   - Choose a service account (or default gmail-api-push@system.gserviceaccount.com)
 *   - Set Audience to the full URL of our endpoint, e.g.
 *     https://mailmind.se/api/webhooks/gmail/push
 *   - Set GMAIL_PUSH_AUDIENCE in Vercel env to that exact URL
 *
 * On every push, Google signs a short-lived JWT with the service account's
 * private key and puts it in `Authorization: Bearer <jwt>`. We verify:
 *   1. Signature against Google's public OIDC keys
 *   2. iss = "https://accounts.google.com"
 *   3. aud = our expected audience
 *   4. exp not expired
 *   5. (optional) email = expected sender service account
 */

import { createPublicKey, createVerify } from "crypto";

const GOOGLE_OIDC_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

type GoogleJwk = {
  kid: string;
  alg: string;
  kty: string;
  n: string;
  e: string;
  use?: string;
};

type JwtHeader = { alg: string; kid: string; typ?: string };
type JwtPayload = {
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  email?: string;
  email_verified?: boolean;
  sub?: string;
};

// In-memory JWK cache. Google rotates keys ~weekly; cache for 1h is safe.
let _jwkCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;
const JWK_TTL_MS = 60 * 60 * 1000;

async function fetchGoogleJwks(): Promise<GoogleJwk[]> {
  if (_jwkCache && _jwkCache.expiresAt > Date.now()) {
    return _jwkCache.keys;
  }
  const res = await fetch(GOOGLE_OIDC_CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Google JWKs: ${res.status}`);
  const body = await res.json() as { keys: GoogleJwk[] };
  _jwkCache = { keys: body.keys, expiresAt: Date.now() + JWK_TTL_MS };
  return body.keys;
}

function base64urlDecode(s: string): Buffer {
  // base64url → base64
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
  return Buffer.from(padded, "base64");
}

function jwkToPem(jwk: GoogleJwk): string {
  // Node's createPublicKey supports JWK directly
  const key = createPublicKey({ key: jwk as never, format: "jwk" });
  return key.export({ type: "spki", format: "pem" }) as string;
}

export type VerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: string };

/**
 * Verify a Google-signed OIDC JWT.
 *
 * @param token              The Bearer JWT (without "Bearer " prefix)
 * @param expectedAudience   The exact URL Google was configured to call
 * @param expectedEmail      Optional service account email to require
 */
export async function verifyGoogleOidcJwt(
  token: string,
  expectedAudience: string,
  expectedEmail?: string,
): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed_jwt" };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header  = JSON.parse(base64urlDecode(headerB64).toString("utf8")) as JwtHeader;
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")) as JwtPayload;
  } catch {
    return { ok: false, reason: "bad_json" };
  }

  if (header.alg !== "RS256") return { ok: false, reason: "wrong_alg" };
  if (!header.kid)            return { ok: false, reason: "no_kid" };

  // Find the matching JWK
  const jwks = await fetchGoogleJwks();
  const jwk = jwks.find(k => k.kid === header.kid);
  if (!jwk) {
    // Force-refresh in case Google just rotated
    _jwkCache = null;
    const fresh = await fetchGoogleJwks();
    const retry = fresh.find(k => k.kid === header.kid);
    if (!retry) return { ok: false, reason: "kid_not_found" };
  }
  const matchedJwk = jwk ?? (await fetchGoogleJwks()).find(k => k.kid === header.kid);
  if (!matchedJwk) return { ok: false, reason: "kid_not_found" };

  // Verify signature
  const signedData = `${headerB64}.${payloadB64}`;
  const signature  = base64urlDecode(sigB64);
  const pem        = jwkToPem(matchedJwk);
  const verifier   = createVerify("RSA-SHA256");
  verifier.update(signedData);
  verifier.end();
  if (!verifier.verify(pem, signature)) {
    return { ok: false, reason: "bad_signature" };
  }

  // Claims
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    return { ok: false, reason: "bad_issuer" };
  }
  if (payload.aud !== expectedAudience) {
    return { ok: false, reason: "bad_audience" };
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (expectedEmail && payload.email !== expectedEmail) {
    return { ok: false, reason: "bad_email" };
  }

  return { ok: true, payload };
}
