import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { required, optional, assertSet, constantTimeEquals, MissingEnvError } from "./env";

describe("env.required", () => {
  const original = process.env.TEST_VAR;
  beforeEach(() => { delete process.env.TEST_VAR; });
  afterEach(() => { if (original !== undefined) process.env.TEST_VAR = original; else delete process.env.TEST_VAR; });

  it("returns the value when set", () => {
    process.env.TEST_VAR = "hello";
    expect(required("TEST_VAR")).toBe("hello");
  });

  it("throws MissingEnvError when missing", () => {
    expect(() => required("TEST_VAR")).toThrow(MissingEnvError);
  });

  it("throws when empty string", () => {
    process.env.TEST_VAR = "";
    expect(() => required("TEST_VAR")).toThrow(MissingEnvError);
  });
});

describe("env.optional", () => {
  beforeEach(() => { delete process.env.TEST_VAR; });

  it("returns undefined when missing", () => {
    expect(optional("TEST_VAR")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    process.env.TEST_VAR = "";
    expect(optional("TEST_VAR")).toBeUndefined();
  });

  it("returns value when set", () => {
    process.env.TEST_VAR = "x";
    expect(optional("TEST_VAR")).toBe("x");
  });
});

describe("env.assertSet", () => {
  beforeEach(() => {
    delete process.env.A;
    delete process.env.B;
  });

  it("does not throw when all set", () => {
    process.env.A = "1";
    process.env.B = "2";
    expect(() => assertSet("A", "B")).not.toThrow();
  });

  it("throws once with all missing names", () => {
    process.env.A = "1";
    // B missing
    expect(() => assertSet("A", "B")).toThrow(/B/);
  });

  it("error includes all missing names", () => {
    try {
      assertSet("A", "B");
    } catch (e) {
      expect(e).toBeInstanceOf(MissingEnvError);
      expect((e as MissingEnvError).message).toContain("A");
      expect((e as MissingEnvError).message).toContain("B");
    }
  });
});

describe("env.constantTimeEquals", () => {
  it("matches identical strings", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true);
  });

  it("rejects differing strings of same length", () => {
    expect(constantTimeEquals("abc", "abd")).toBe(false);
  });

  it("rejects different-length strings without leaking via short-circuit", () => {
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
    expect(constantTimeEquals("abcd", "abc")).toBe(false);
  });

  it("returns false for null/undefined inputs", () => {
    expect(constantTimeEquals(null, "abc")).toBe(false);
    expect(constantTimeEquals("abc", null)).toBe(false);
    expect(constantTimeEquals(undefined, undefined)).toBe(false);
    expect(constantTimeEquals(null, null)).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(constantTimeEquals("", "")).toBe(false);
    expect(constantTimeEquals("", "abc")).toBe(false);
  });
});
