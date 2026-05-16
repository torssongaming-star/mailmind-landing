import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, RATE_LIMITS } from "./rate-limit";

describe("rateLimit", () => {
  // Use unique keys per test to avoid cross-contamination of the shared bucket map
  let testId = 0;
  const key = () => `test-${++testId}-${Date.now()}`;

  beforeEach(() => { testId = 0; });

  it("allows requests within capacity", () => {
    const k = key();
    const opts = { capacity: 5, refillPerSec: 1 };
    expect(rateLimit(k, opts)).toBe(true);
    expect(rateLimit(k, opts)).toBe(true);
    expect(rateLimit(k, opts)).toBe(true);
  });

  it("blocks when capacity is exhausted", () => {
    const k = key();
    const opts = { capacity: 3, refillPerSec: 0 }; // no refill — strict limit
    expect(rateLimit(k, opts)).toBe(true);
    expect(rateLimit(k, opts)).toBe(true);
    expect(rateLimit(k, opts)).toBe(true);
    expect(rateLimit(k, opts)).toBe(false); // exhausted
  });

  it("isolates buckets per key", () => {
    const opts = { capacity: 1, refillPerSec: 0 };
    expect(rateLimit("a-1", opts)).toBe(true);
    expect(rateLimit("a-2", opts)).toBe(true);
    // a-1 still has its own bucket — already empty though
    expect(rateLimit("a-1", opts)).toBe(false);
  });

  it("refills tokens over time", async () => {
    const k = key();
    const opts = { capacity: 1, refillPerSec: 100 }; // refills fast
    expect(rateLimit(k, opts)).toBe(true);
    expect(rateLimit(k, opts)).toBe(false);
    // Wait ~50ms — should have refilled ~5 tokens
    await new Promise(r => setTimeout(r, 80));
    expect(rateLimit(k, opts)).toBe(true);
  });
});

describe("RATE_LIMITS presets", () => {
  it("aiDraft allows ~1 req/sec sustained", () => {
    expect(RATE_LIMITS.aiDraft.capacity).toBe(60);
    expect(RATE_LIMITS.aiDraft.refillPerSec).toBe(1);
  });

  it("invite refills at 10/hour", () => {
    expect(RATE_LIMITS.invite.capacity).toBe(10);
    expect(RATE_LIMITS.invite.refillPerSec).toBeCloseTo(10 / 3600);
  });

  it("inboundWebhook has high burst capacity", () => {
    expect(RATE_LIMITS.inboundWebhook.capacity).toBeGreaterThanOrEqual(100);
  });
});
