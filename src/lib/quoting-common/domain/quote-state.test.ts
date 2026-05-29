/**
 * Tests for the quote state machine.
 * Follows the same vitest pattern as entitlements.products.test.ts.
 */

import { describe, it, expect } from "vitest";
import { canTransition, allowedTransitions, isTerminal } from "./quote-state";
import type { QuoteStatus } from "./types";

describe("canTransition", () => {
  it("allows draft → ready", () => {
    expect(canTransition("draft", "ready")).toBe(true);
  });

  it("allows draft → calculating", () => {
    expect(canTransition("draft", "calculating")).toBe(true);
  });

  it("allows ready → sent", () => {
    expect(canTransition("ready", "sent")).toBe(true);
  });

  it("allows sent → viewed", () => {
    expect(canTransition("sent", "viewed")).toBe(true);
  });

  it("allows viewed → accepted", () => {
    expect(canTransition("viewed", "accepted")).toBe(true);
  });

  it("allows accepted → signed", () => {
    expect(canTransition("accepted", "signed")).toBe(true);
  });

  it("blocks draft → sent (must go via ready)", () => {
    expect(canTransition("draft", "sent")).toBe(false);
  });

  it("blocks draft → signed (many steps skipped)", () => {
    expect(canTransition("draft", "signed")).toBe(false);
  });

  it("blocks sent → accepted (must be viewed first)", () => {
    expect(canTransition("sent", "accepted")).toBe(false);
  });

  it("allows any non-terminal → rejected (soft-delete)", () => {
    const nonTerminal: QuoteStatus[] = ["draft", "calculating", "ready", "sent", "viewed", "accepted"];
    for (const s of nonTerminal) {
      expect(canTransition(s, "rejected")).toBe(true);
    }
  });

  it("blocks signed → any status (terminal)", () => {
    const all: QuoteStatus[] = ["draft", "calculating", "ready", "sent", "viewed", "accepted", "signed", "rejected", "expired"];
    for (const s of all) {
      expect(canTransition("signed", s)).toBe(false);
    }
  });

  it("blocks rejected → any status (terminal)", () => {
    const all: QuoteStatus[] = ["draft", "calculating", "ready", "sent", "viewed", "accepted", "signed", "rejected", "expired"];
    for (const s of all) {
      expect(canTransition("rejected", s)).toBe(false);
    }
  });

  it("blocks expired → any status (terminal)", () => {
    const all: QuoteStatus[] = ["draft", "calculating", "ready", "sent", "viewed", "accepted", "signed", "rejected", "expired"];
    for (const s of all) {
      expect(canTransition("expired", s)).toBe(false);
    }
  });
});

describe("isTerminal", () => {
  it("signed is terminal", () => {
    expect(isTerminal("signed")).toBe(true);
  });

  it("rejected is terminal", () => {
    expect(isTerminal("rejected")).toBe(true);
  });

  it("expired is terminal", () => {
    expect(isTerminal("expired")).toBe(true);
  });

  it("draft is not terminal", () => {
    expect(isTerminal("draft")).toBe(false);
  });

  it("ready is not terminal", () => {
    expect(isTerminal("ready")).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("returns next states from draft", () => {
    expect(allowedTransitions("draft")).toEqual(
      expect.arrayContaining(["calculating", "ready", "rejected"]),
    );
  });

  it("returns empty array for terminal status", () => {
    expect(allowedTransitions("signed")).toHaveLength(0);
  });
});
