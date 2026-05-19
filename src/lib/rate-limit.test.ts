import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, RATE_LIMITS } from "./rate-limit";

describe("rateLimit", () => {
  // Use unique keys per test to avoid cross-contamination of the shared bucket map
  let testId = 0;
  const key = () => `test-${++testId}-${Date.now()}`;

  beforeEach(() => { testId = 0; });

  it("allows requests within capacity", async () => {
    const k = key();
    const opts = { capacity: 5, refillPerSec: 1 };
    expect(await rateLimit(k, opts)).toBe(true);
    expect(await rateLimit(k, opts)).toBe(true);
    expect(await rateLimit(k, opts)).toBe(true);
  });

  it("blocks when capacity is exhausted", async () => {
    const k = key();
    const opts = { capacity: 3, refillPerSec: 0 }; // no refill — strict limit
    expect(await rateLimit(k, opts)).toBe(true);
    expect(await rateLimit(k, opts)).toBe(true);
    expect(await rateLimit(k, opts)).toBe(true);
    expect(await rateLimit(k, opts)).toBe(false); // exhausted
  });

  it("isolates buckets per key", async () => {
    const opts = { capacity: 1, refillPerSec: 0 };
    expect(await rateLimit("a-1", opts)).toBe(true);
    expect(await rateLimit("a-2", opts)).toBe(true);
    // a-1 still has its own bucket — already empty though
    expect(await rateLimit("a-1", opts)).toBe(false);
  });

  it("refills tokens over time", async () => {
    const k = key();
    const opts = { capacity: 1, refillPerSec: 100 }; // refills fast
    expect(await rateLimit(k, opts)).toBe(true);
    expect(await rateLimit(k, opts)).toBe(false);
    // Wait long enough that even on a slow/timer-jittery CI box we have
    // refilled well over 1 token. 200ms × 100/sec = 20 tokens.
    await new Promise(r => setTimeout(r, 200));
    expect(await rateLimit(k, opts)).toBe(true);
  });
});

describe("RATE_LIMITS presets", () => {
  it("aiDraft allows ~1 req/sec sustained", async () => {
    expect(RATE_LIMITS.aiDraft.capacity).toBe(60);
    expect(RATE_LIMITS.aiDraft.refillPerSec).toBe(1);
  });

  it("invite refills at 10/hour", async () => {
    expect(RATE_LIMITS.invite.capacity).toBe(10);
    expect(RATE_LIMITS.invite.refillPerSec).toBeCloseTo(10 / 3600);
  });

  it("inboundWebhook has high burst capacity", async () => {
    expect(RATE_LIMITS.inboundWebhook.capacity).toBeGreaterThanOrEqual(100);
  });
});
