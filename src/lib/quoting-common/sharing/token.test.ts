import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createShareToken, verifyShareToken, isShareConfigured } from "./token";

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

  it("round-trips a quoteId", () => {
    const token = createShareToken(QUOTE_ID);
    expect(verifyShareToken(token)).toBe(QUOTE_ID);
  });

  it("rejects a tampered payload", () => {
    const token = createShareToken(QUOTE_ID);
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("99999999-0000-0000-0000-000000000000").toString("base64url")}.${sig}`;
    expect(verifyShareToken(forged)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createShareToken(QUOTE_ID);
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
    const token = createShareToken(QUOTE_ID);
    process.env.QUOTE_SHARE_SECRET = "a-different-secret";
    expect(verifyShareToken(token)).toBeNull();
  });

  it("disables the feature when the secret is unset", () => {
    delete process.env.QUOTE_SHARE_SECRET;
    expect(isShareConfigured()).toBe(false);
    expect(verifyShareToken("anything.here")).toBeNull();
    expect(() => createShareToken(QUOTE_ID)).toThrow();
  });

  it("reports configured when the secret is set", () => {
    expect(isShareConfigured()).toBe(true);
  });
});
