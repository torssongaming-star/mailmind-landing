import { describe, it, expect } from "vitest";
import { runConstructionEstimate } from "./estimate";
import {
  ConstructionEstimateInputSchema,
  CONSTRUCTION_ENGINE_VERSION,
  type ConstructionEstimateInput,
} from "./types";

// ── Fixture ───────────────────────────────────────────────────────────────────

function input(overrides: Partial<ConstructionEstimateInput> = {}): ConstructionEstimateInput {
  return ConstructionEstimateInputSchema.parse({
    projectType:          "Badrumsrenovering",
    areaM2:               10,
    materialCostSekPerM2: 3000,
    labourHours:          80,
    labourRateSekPerHour: 650,
    ...overrides,
  });
}

describe("runConstructionEstimate", () => {
  it("computes material + labour + VAT with ROT on labour", () => {
    const r = runConstructionEstimate(input());
    // material = 10 * 3000 = 30 000
    expect(r.materialCostSek).toBe(30000);
    // labour = 80 * 650 = 52 000
    expect(r.labourCostSek).toBe(52000);
    // subtotal = 82 000
    expect(r.subtotalSek).toBe(82000);
    // vat = 82 000 * 0.25 = 20 500
    expect(r.vatSek).toBe(20500);
    // rot = min(52 000 * 0.30, 50 000) = 15 600
    expect(r.rotDeductionSek).toBe(15600);
    // total = 82 000 + 20 500 − 15 600 = 86 900
    expect(r.totalSek).toBe(86900);
  });

  it("excludes ROT when includeRot is false", () => {
    const r = runConstructionEstimate(input({ includeRot: false }));
    expect(r.rotDeductionSek).toBe(0);
    expect(r.totalSek).toBe(r.subtotalSek + r.vatSek);
  });

  it("caps ROT at rotMaxSek", () => {
    // Large labour cost: 1000h * 650 = 650 000 → 30% = 195 000, capped at 50 000
    const r = runConstructionEstimate(input({ labourHours: 1000 }));
    expect(r.rotDeductionSek).toBe(50000);
  });

  it("allows a doubled ROT cap for two adults", () => {
    const r = runConstructionEstimate(input({ labourHours: 1000, rotMaxSek: 100000 }));
    // 195 000 capped at 100 000
    expect(r.rotDeductionSek).toBe(100000);
  });

  it("handles zero material (labour-only job)", () => {
    const r = runConstructionEstimate(input({ materialCostSekPerM2: 0 }));
    expect(r.materialCostSek).toBe(0);
    expect(r.subtotalSek).toBe(r.labourCostSek);
  });

  it("stamps the pinned engine version", () => {
    const r = runConstructionEstimate(input());
    expect(r.engineVersion).toBe(CONSTRUCTION_ENGINE_VERSION);
  });

  it("is deterministic — same input yields identical output", () => {
    const a = runConstructionEstimate(input());
    const b = runConstructionEstimate(input());
    expect(a).toEqual(b);
  });
});
