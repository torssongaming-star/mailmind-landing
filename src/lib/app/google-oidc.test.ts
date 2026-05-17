/**
 * verifyGoogleOidcJwt() tests — strategi-revision P2.4.
 *
 * Uses a real RSA-2048 key pair generated in-process so we test the full
 * signature path. `fetch` is mocked to return the test public key as a
 * JWKS response (same shape as https://www.googleapis.com/oauth2/v3/certs).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, createSign, KeyObject } from "crypto";
import { verifyGoogleOidcJwt } from "./google-oidc";

// ── Key generation (once per file, ~300ms) ────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TEST_KID    = "test-key-id-1";
const AUDIENCE    = "https://mailmind.se/api/webhooks/gmail/push";
const ISSUER      = "https://accounts.google.com";
const SERVICE_ACC = "gmail-api-push@system.gserviceaccount.com";

// Export public key as JWK so we can return it from the mocked fetch
function publicKeyAsJwk(key: KeyObject, kid: string) {
  const raw = key.export({ format: "jwk" }) as Record<string, string>;
  return { ...raw, kid, use: "sig", alg: "RS256" };
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(payload: Record<string, unknown>, kid = TEST_KID): string {
  const header = base64url(JSON.stringify({ alg: "RS256", kid }));
  const body   = base64url(JSON.stringify(payload));
  const data   = `${header}.${body}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  const sig = base64url(signer.sign(privateKey));
  return `${data}.${sig}`;
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss:            ISSUER,
    aud:            AUDIENCE,
    exp:            Math.floor(Date.now() / 1000) + 3600,
    iat:            Math.floor(Date.now() / 1000),
    sub:            "12345",
    email:          SERVICE_ACC,
    email_verified: true,
    ...overrides,
  };
}

// ── Mock fetch ────────────────────────────────────────────────────────────────

const jwksResponse = {
  keys: [publicKeyAsJwk(publicKey, TEST_KID)],
};

beforeEach(() => {
  // Reset the module-level JWK cache between tests
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok:   true,
    json: () => Promise.resolve(jwksResponse),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("verifyGoogleOidcJwt — valid token", () => {
  it("accepts a correctly signed token", async () => {
    const token = makeJwt(validPayload());
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(true);
  });

  it("returns the payload on success", async () => {
    const token = makeJwt(validPayload());
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    if (!r.ok) throw new Error("Expected ok");
    expect(r.payload.iss).toBe(ISSUER);
    expect(r.payload.email).toBe(SERVICE_ACC);
  });

  it("accepts when email pinning matches", async () => {
    const token = makeJwt(validPayload());
    const r = await verifyGoogleOidcJwt(token, AUDIENCE, SERVICE_ACC);
    expect(r.ok).toBe(true);
  });
});

// ── Wrong audience ─────────────────────────────────────────────────────────────

describe("verifyGoogleOidcJwt — wrong audience → 401", () => {
  it("rejects when aud is a different URL", async () => {
    const token = makeJwt(validPayload({ aud: "https://evil.example.com/webhook" }));
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_audience");
  });

  it("rejects when aud is empty string", async () => {
    const token = makeJwt(validPayload({ aud: "" }));
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_audience");
  });

  it("rejects when aud is missing", async () => {
    const p = validPayload();
    delete p.aud;
    const token = makeJwt(p);
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(false);
  });
});

// ── Other claim failures ───────────────────────────────────────────────────────

describe("verifyGoogleOidcJwt — claim failures", () => {
  it("rejects wrong issuer", async () => {
    const token = makeJwt(validPayload({ iss: "https://evil.google.com" }));
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_issuer");
  });

  it("rejects expired token", async () => {
    const token = makeJwt(validPayload({ exp: Math.floor(Date.now() / 1000) - 1 }));
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("rejects when email pinning fails", async () => {
    const token = makeJwt(validPayload({ email: "other@system.gserviceaccount.com" }));
    const r = await verifyGoogleOidcJwt(token, AUDIENCE, SERVICE_ACC);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_email");
  });

  it("rejects bad signature (tampered payload)", async () => {
    const token = makeJwt(validPayload());
    // Flip one char in the payload segment
    const parts = token.split(".");
    parts[1] = parts[1].slice(0, -1) + (parts[1].endsWith("A") ? "B" : "A");
    const r = await verifyGoogleOidcJwt(parts.join("."), AUDIENCE);
    expect(r.ok).toBe(false);
  });

  it("rejects malformed token (not 3 parts)", async () => {
    const r = await verifyGoogleOidcJwt("not.a.valid.jwt", AUDIENCE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("malformed_jwt");
  });

  it("rejects unknown kid", async () => {
    const token = makeJwt(validPayload(), "unknown-kid");
    const r = await verifyGoogleOidcJwt(token, AUDIENCE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("kid_not_found");
  });
});
