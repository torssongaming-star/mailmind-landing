/**
 * canAutoSend() tests — strategi-revision P2.7.
 *
 * This function is the *security perimeter* for auto-sent AI replies. Any
 * regression that lets a draft through without all 6 conditions met is an
 * immediate brand/security incident. These tests are MANDATORY in CI.
 *
 * Locked rules (all must pass):
 *   1. confidence ≥ 0.90
 *   2. source_grounded === true
 *   3. risk_level === "low"
 *   4. action !== "escalate"
 *   5. interactionCount ≥ 3 (not a brand-new customer)
 *   6. !isBlocked (sender not manually blocked)
 */

import { describe, it, expect } from "vitest";
import { canAutoSend, AUTO_SEND_CONFIDENCE_THRESHOLD, type AutoSendParams } from "./autoSend";

/** Base params that PASS — change one field per test to verify the gate. */
const passing: AutoSendParams = {
  action:           "summarize",
  confidence:       0.95,
  riskLevel:        "low",
  sourceGrounded:   true,
  interactionCount: 5,
  isBlocked:        false,
};

describe("canAutoSend — happy path", () => {
  it("allows when all 6 conditions met", () => {
    const result = canAutoSend(passing);
    expect(result.eligible).toBe(true);
  });

  it("allows at exactly the confidence threshold (0.90)", () => {
    const result = canAutoSend({ ...passing, confidence: AUTO_SEND_CONFIDENCE_THRESHOLD });
    expect(result.eligible).toBe(true);
  });

  it("allows at exactly interactionCount = 3", () => {
    const result = canAutoSend({ ...passing, interactionCount: 3 });
    expect(result.eligible).toBe(true);
  });
});

describe("canAutoSend — rule 1: confidence ≥ 0.90", () => {
  it("blocks confidence = 0.89", () => {
    const r = canAutoSend({ ...passing, confidence: 0.89 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers.some(b => b.startsWith("confidence_too_low"))).toBe(true);
  });

  it("blocks confidence = 0.5", () => {
    const r = canAutoSend({ ...passing, confidence: 0.5 });
    expect(r.eligible).toBe(false);
  });

  it("blocks confidence = 0", () => {
    const r = canAutoSend({ ...passing, confidence: 0 });
    expect(r.eligible).toBe(false);
  });
});

describe("canAutoSend — rule 2: source_grounded", () => {
  it("blocks when sourceGrounded = false", () => {
    const r = canAutoSend({ ...passing, sourceGrounded: false });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("not_source_grounded");
  });
});

describe("canAutoSend — rule 3: risk_level = low", () => {
  it("blocks risk_level = medium", () => {
    const r = canAutoSend({ ...passing, riskLevel: "medium" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("risk_level_medium");
  });

  it("blocks risk_level = high", () => {
    const r = canAutoSend({ ...passing, riskLevel: "high" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("risk_level_high");
  });
});

describe("canAutoSend — rule 4: action !== escalate", () => {
  it("blocks action = escalate", () => {
    const r = canAutoSend({ ...passing, action: "escalate" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("action_is_escalate");
  });

  it("allows action = ask (if everything else passes)", () => {
    const r = canAutoSend({ ...passing, action: "ask" });
    expect(r.eligible).toBe(true);
  });
});

describe("canAutoSend — rule 5: interactionCount ≥ 3", () => {
  it("blocks interactionCount = 0", () => {
    const r = canAutoSend({ ...passing, interactionCount: 0 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers.some(b => b.startsWith("new_customer"))).toBe(true);
  });

  it("blocks interactionCount = 2", () => {
    const r = canAutoSend({ ...passing, interactionCount: 2 });
    expect(r.eligible).toBe(false);
  });
});

describe("canAutoSend — rule 6: sender not blocked", () => {
  it("blocks when isBlocked = true", () => {
    const r = canAutoSend({ ...passing, isBlocked: true });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("sender_blocked");
  });
});

describe("canAutoSend — multiple failures", () => {
  it("reports all blockers, not just the first", () => {
    const r = canAutoSend({
      ...passing,
      confidence:       0.5,
      sourceGrounded:   false,
      riskLevel:        "high",
      action:           "escalate",
      interactionCount: 1,
      isBlocked:        true,
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) {
      expect(r.blockers.length).toBeGreaterThanOrEqual(6);
      expect(r.blockers.some(b => b.startsWith("confidence_too_low"))).toBe(true);
      expect(r.blockers).toContain("not_source_grounded");
      expect(r.blockers).toContain("risk_level_high");
      expect(r.blockers).toContain("action_is_escalate");
      expect(r.blockers.some(b => b.startsWith("new_customer"))).toBe(true);
      expect(r.blockers).toContain("sender_blocked");
    }
  });
});

describe("canAutoSend — locked threshold values", () => {
  it("AUTO_SEND_CONFIDENCE_THRESHOLD is exactly 0.90", () => {
    // If this constant changes, a senior reviewer MUST sign off.
    // The product promise is "≥ 90%". Loosening this is a customer-facing
    // change to the GTM contract.
    expect(AUTO_SEND_CONFIDENCE_THRESHOLD).toBe(0.90);
  });
});
