import { describe, it, expect } from "vitest";
import {
  filterCustomerFacing,
  isCustomerFacing,
  extractBodies,
  auditBlocked,
  runEgressGate,
} from "./gate";
import type { KbEntry } from "../domain/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE: Omit<KbEntry, "id" | "visibility"> = {
  organizationId: "org-1",
  title:          "Test entry",
  body:           "Test body",
  category:       "faq",
  vertical:       null,
  source:         null,
  createdBy:      null,
  createdAt:      new Date("2025-01-01"),
  updatedAt:      new Date("2025-01-01"),
};

function entry(id: string, visibility: KbEntry["visibility"], vertical?: string): KbEntry {
  return { ...BASE, id, visibility, vertical: vertical ?? null };
}

const INTERNAL  = entry("e1", "internal_only");
const CUSTOMER  = entry("e2", "customer_facing");
const SOLAR_INT = entry("e3", "internal_only", "solar");
const SOLAR_CF  = entry("e4", "customer_facing", "solar");
const UNIVERSAL_CF = entry("e5", "customer_facing"); // vertical = null

describe("isCustomerFacing", () => {
  it("returns true for customer_facing", () => {
    expect(isCustomerFacing(CUSTOMER)).toBe(true);
  });

  it("returns false for internal_only", () => {
    expect(isCustomerFacing(INTERNAL)).toBe(false);
  });
});

describe("filterCustomerFacing", () => {
  it("passes only customer_facing entries", () => {
    const result = filterCustomerFacing([INTERNAL, CUSTOMER, SOLAR_INT, SOLAR_CF]);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["e2", "e4"]);
  });

  it("returns empty array when all entries are internal", () => {
    expect(filterCustomerFacing([INTERNAL, SOLAR_INT])).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterCustomerFacing([])).toEqual([]);
  });
});

describe("extractBodies", () => {
  const entries = [INTERNAL, CUSTOMER, SOLAR_INT, SOLAR_CF, UNIVERSAL_CF];

  it("returns body text only for customer_facing entries", () => {
    const bodies = extractBodies([INTERNAL, CUSTOMER]);
    expect(bodies).toEqual(["Test body"]);
  });

  it("respects maxEntries cap", () => {
    const bodies = extractBodies(entries, { maxEntries: 1 });
    expect(bodies).toHaveLength(1);
  });

  it("filters by vertical — excludes entries scoped to another vertical", () => {
    const bodies = extractBodies(entries, { vertical: "solar" });
    // CUSTOMER (null vertical) and SOLAR_CF should both pass vertical filter
    // UNIVERSAL_CF (null vertical) also passes
    expect(bodies).toHaveLength(3); // CUSTOMER (e2), SOLAR_CF (e4), UNIVERSAL_CF (e5)
  });

  it("vertical filter excludes null-vertical entries when null passed explicitly", () => {
    // null vertical means "all verticals" — universal entries pass any filter
    const bodies = extractBodies([SOLAR_CF, UNIVERSAL_CF], { vertical: "construction" });
    // SOLAR_CF is scoped to solar → excluded; UNIVERSAL_CF (null) → included
    expect(bodies).toHaveLength(1);
  });

  it("returns empty when no customer_facing entries exist", () => {
    expect(extractBodies([INTERNAL, SOLAR_INT])).toEqual([]);
  });
});

describe("auditBlocked", () => {
  it("returns blocked entries with reason", () => {
    const map = auditBlocked([INTERNAL, CUSTOMER, SOLAR_INT]);
    expect(map.size).toBe(2);
    expect(map.has("e1")).toBe(true);
    expect(map.has("e3")).toBe(true);
    expect(map.has("e2")).toBe(false);
    expect(map.get("e1")).toContain("internal_only");
  });

  it("returns empty map when all entries are customer_facing", () => {
    expect(auditBlocked([CUSTOMER, SOLAR_CF])).toHaveLength(0);
  });
});

// ── runEgressGate ─────────────────────────────────────────────────────────────

const INTERNAL_LONG = {
  ...BASE,
  id:         "int-long",
  visibility: "internal_only" as const,
  body:       "Our internal margin is 42 percent on all solar installations",
};

describe("runEgressGate", () => {
  it("empty text + no internal entries → ok", () => {
    const r = runEgressGate({ renderedText: "" }, []);
    expect(r.ok).toBe(true);
    expect(r.blockedReasons).toHaveLength(0);
  });

  it("text containing TODO → placeholder_detected", () => {
    const r = runEgressGate({ renderedText: "Please review. TODO: add price." }, []);
    expect(r.ok).toBe(false);
    expect(r.blockedReasons).toContain("placeholder_detected");
  });

  it("text containing [FYLL I] → placeholder_detected", () => {
    const r = runEgressGate({ renderedText: "Kontakta [FYLL I] för mer info." }, []);
    expect(r.ok).toBe(false);
    expect(r.blockedReasons).toContain("placeholder_detected");
  });

  it("text with substring from internal_only entry → internal_data_detected", () => {
    const renderedText = "Our internal margin is 42 percent on all solar installations and we are proud.";
    const r = runEgressGate({ renderedText }, [INTERNAL_LONG]);
    expect(r.ok).toBe(false);
    expect(r.blockedReasons).toContain("internal_data_detected");
  });

  it("text with substring from customer_facing entry → ok (not blocked)", () => {
    const cfEntry = { ...BASE, id: "cf1", visibility: "customer_facing" as const,
      body: "We offer a 25-year production warranty on all panels." };
    const renderedText = "We offer a 25-year production warranty on all panels.";
    const r = runEgressGate({ renderedText }, [cfEntry]);
    expect(r.ok).toBe(true);
  });

  it("clean text with irrelevant internal entries → ok", () => {
    const r = runEgressGate(
      { renderedText: "Your solar system will produce 8 500 kWh per year." },
      [INTERNAL_LONG],
    );
    expect(r.ok).toBe(true);
  });

  it("text with both placeholder and internal match → two blocked reasons", () => {
    const renderedText = "TODO: Our internal margin is 42 percent on all solar installations";
    const r = runEgressGate({ renderedText }, [INTERNAL_LONG]);
    expect(r.ok).toBe(false);
    expect(r.blockedReasons).toHaveLength(2);
    expect(r.blockedReasons).toContain("placeholder_detected");
    expect(r.blockedReasons).toContain("internal_data_detected");
  });
});
