import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createShareToken, verifyShareToken, isShareConfigured } from "./token";

const ORG_ID   = "aaaaaaaa-1111-2222-3333-444444444444";
const QUOTE_ID = "11111111-2222-3333-4444-555555555555";

describe("quote share tokens", () => {
  const original = process.env.QUOTE_SHARE_SECRET;

  beforeEach(() => {
    process.env.QUOTE_SHARE_SECRET = "test-secret-abc";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.QUOTE_SHARE_SECRET;
    else process.env.QUOTE_SHARE_SECRET = original;
  });

  it("round-trips orgId + quoteId claims", () => {
    const token = createShareToken(ORG_ID, QUOTE_ID);
    expect(verifyShareToken(token)).toEqual({ orgId: ORG_ID, quoteId: QUOTE_ID });
  });

  it("rejects a tampered payload", () => {
    const token = createShareToken(ORG_ID, QUOTE_ID);
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(`${ORG_ID}:99999999-0000-0000-0000-000000000000`).toString("base64url")}.${sig}`;
    expect(verifyShareToken(forged)).toBeNull();
  });

  it("rejects a swapped orgId in the payload", () => {
    const token = createShareToken(ORG_ID, QUOTE_ID);
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(`evil-org:${QUOTE_ID}`).toString("base64url")}.${sig}`;
    expect(verifyShareToken(forged)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createShareToken(ORG_ID, QUOTE_ID);
    const [payload] = token.split(".");
    const forged = `${payload}.${Buffer.from("garbage").toString("base64url")}`;
    expect(verifyShareToken(forged)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyShareToken("")).toBeNull();
    expect(verifyShareToken("nodot")).toBeNull();
    expect(verifyShareToken(".")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createShareToken(ORG_ID, QUOTE_ID);
    process.env.QUOTE_SHARE_SECRET = "a-different-secret";
    expect(verifyShareToken(token)).toBeNull();
  });

  it("disables the feature when the secret is unset", () => {
    delete process.env.QUOTE_SHARE_SECRET;
    expect(isShareConfigured()).toBe(false);
    expect(verifyShareToken("anything.here")).toBeNull();
    expect(() => createShareToken(ORG_ID, QUOTE_ID)).toThrow();
  });

  it("reports configured when the secret is set", () => {
    expect(isShareConfigured()).toBe(true);
  });
});
