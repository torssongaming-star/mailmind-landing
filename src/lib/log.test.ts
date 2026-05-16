import { describe, it, expect, vi } from "vitest";
import { createLogger } from "./log";

describe("createLogger — PII masking", () => {
  it("masks emails in string args", () => {
    const log = createLogger("test");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("user kalle@bolag.se signed in");
    expect(spy.mock.calls[0][1]).toMatch(/k\*\*\*@bolag\.se/);
    spy.mockRestore();
  });

  it("masks Bearer tokens", () => {
    const log = createLogger("test");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("Authorization: Bearer eyJhbGc.payload.sig");
    expect(spy.mock.calls[0][1]).toMatch(/Bearer \*\*\*/);
    expect(spy.mock.calls[0][1]).not.toContain("eyJhbGc");
    spy.mockRestore();
  });

  it("masks UUIDs in messages", () => {
    const log = createLogger("test");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("inbox 7a1c8b32-3d4e-4f5b-9a87-fedcba012345 updated");
    expect(spy.mock.calls[0][1]).toMatch(/7a1c…2345/);
    spy.mockRestore();
  });

  it("redacts password/secret/token keys in context object", () => {
    const log = createLogger("test");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("config", { password: "p4ss", api_key: "k123", normal: "ok" });
    const ctx = spy.mock.calls[0][2] as Record<string, unknown>;
    expect(ctx.password).toBe("***");
    expect(ctx.api_key).toBe("***");
    expect(ctx.normal).toBe("ok");
    spy.mockRestore();
  });

  it("recursively masks nested context", () => {
    const log = createLogger("test");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("ok", { user: { email: "info@bolag.se", role: "owner" } });
    const ctx = spy.mock.calls[0][2] as { user: { email: string; role: string } };
    expect(ctx.user.email).toMatch(/i\*\*\*@bolag\.se/);
    expect(ctx.user.role).toBe("owner");
    spy.mockRestore();
  });

  it("prefixes with [tag]", () => {
    const log = createLogger("microsoft/notifications");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("hello");
    expect(spy.mock.calls[0][0]).toBe("[microsoft/notifications]");
    spy.mockRestore();
  });
});
