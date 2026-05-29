import { describe, it, expect } from "vitest";
import { runSolarRoi } from "./roi";
import { SolarEngineInputSchema } from "./types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal valid input: 10 kWp, south-facing 40° roof, SE market defaults */
const BASE_INPUT = SolarEngineInputSchema.parse({
  surfaces: [{ area: 50, tilt: 40, azimuth: 180, shading: 0 }],
  systemCapacityKwp: 10,
  annualConsumptionKwh: 10_000,
  systemCostSek: 120_000,
});

describe("runSolarRoi", () => {
  // 1 ── Sanity: optimal system produces a plausible annual yield
  it("produces ~7 000–9 000 kWh/yr for a 10 kWp system at optimal orientation", () => {
    const r = runSolarRoi(BASE_INPUT);
    expect(r.annualProductionKwhY1).toBeGreaterThan(7_000);
    expect(r.annualProductionKwhY1).toBeLessThan(9_500);
  });

  // 2 ── South-facing beats north-facing
  it("south-facing surface yields more than north-facing", () => {
    const south = runSolarRoi(BASE_INPUT);
    const north = runSolarRoi(
      SolarEngineInputSchema.parse({ ...BASE_INPUT, surfaces: [{ area: 50, tilt: 40, azimuth: 0, shading: 0 }] }),
    );
    expect(south.annualProductionKwhY1).toBeGreaterThan(north.annualProductionKwhY1);
  });

  // 3 ── Heavy shading cuts production
  it("50 % shading reduces production by ~50 %", () => {
    const clear  = runSolarRoi(BASE_INPUT);
    const shaded = runSolarRoi(
      SolarEngineInputSchema.parse({ ...BASE_INPUT, surfaces: [{ area: 50, tilt: 40, azimuth: 180, shading: 0.5 }] }),
    );
    const ratio = shaded.annualProductionKwhY1 / clear.annualProductionKwhY1;
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  // 4 ── Self-consumption rate decreases as production grows relative to consumption
  it("self-consumption rate decreases when system is oversized vs consumption", () => {
    const small = runSolarRoi(SolarEngineInputSchema.parse({ ...BASE_INPUT, systemCapacityKwp: 5 }));
    const large = runSolarRoi(SolarEngineInputSchema.parse({ ...BASE_INPUT, systemCapacityKwp: 30 }));
    expect(small.selfConsumptionRate).toBeGreaterThan(large.selfConsumptionRate);
  });

  // 5 ── Feed-in + self-consumed = total production (year 1)
  it("feedInKwhY1 + selfConsumptionKwhY1 equals annualProductionKwhY1", () => {
    const r = runSolarRoi(BASE_INPUT);
    expect(r.feedInKwhY1 + r.selfConsumptionKwhY1).toBeCloseTo(r.annualProductionKwhY1, 3);
  });

  // 6 ── ROT deduction calculation
  it("calculates ROT deduction correctly (30 % of 40 % of cost)", () => {
    const r = runSolarRoi(BASE_INPUT);
    // 120 000 × 0.40 × 0.30 = 14 400 SEK
    expect(r.rotDeductionSek).toBeCloseTo(14_400, 0);
    expect(r.netSystemCostSek).toBeCloseTo(120_000 - 14_400, 0);
  });

  // 7 ── ROT deduction is capped at rotMaxSek
  it("ROT deduction is capped at rotMaxSek", () => {
    const bigSystem = SolarEngineInputSchema.parse({
      ...BASE_INPUT,
      systemCostSek: 1_000_000,  // 1M SEK → theoretical ROT = 120k, capped at 50k
    });
    const r = runSolarRoi(bigSystem);
    expect(r.rotDeductionSek).toBeCloseTo(50_000, 0);
  });

  // 8 ── includeRot=false gives zero ROT
  it("includeRot=false gives zero ROT deduction", () => {
    const r = runSolarRoi(SolarEngineInputSchema.parse({ ...BASE_INPUT, includeRot: false }));
    expect(r.rotDeductionSek).toBe(0);
    expect(r.netSystemCostSek).toBeCloseTo(BASE_INPUT.systemCostSek, 0);
  });

  // 9 ── yearlyData has correct length and year 20 < year 1 due to degradation
  it("yearlyData has analysisYears entries and last year < year 1 production", () => {
    const r = runSolarRoi(BASE_INPUT);
    expect(r.yearlyData).toHaveLength(BASE_INPUT.analysisYears);
    expect(r.yearlyData[19].productionKwh).toBeLessThan(r.yearlyData[0].productionKwh);
  });

  // 10 ── Cumulative savings are non-decreasing
  it("cumulativeSavingsSek is strictly increasing over 20 years", () => {
    const r = runSolarRoi(BASE_INPUT);
    for (let i = 1; i < r.yearlyData.length; i++) {
      expect(r.yearlyData[i].cumulativeSavingsSek).toBeGreaterThan(
        r.yearlyData[i - 1].cumulativeSavingsSek,
      );
    }
  });

  // 11 ── NPV > 0 for a typical SE system over 20 years
  it("NPV is positive for a well-sized SE system over 20 years", () => {
    const r = runSolarRoi(BASE_INPUT);
    expect(r.npv).toBeGreaterThan(0);
  });

  // 12 ── IRR is null when investment never pays back
  it("IRR is null when savings never cover the investment", () => {
    const hopeless = SolarEngineInputSchema.parse({
      ...BASE_INPUT,
      systemCostSek: 10_000_000, // 10 M SEK — never pays back in 20 yr
      includeRot: false,
    });
    const r = runSolarRoi(hopeless);
    expect(r.irr).toBeNull();
  });

  // 13 ── CO₂ avoided is proportional to production
  it("co2AvoidedKgPerYearY1 ≈ 0.045 × annualProductionKwhY1", () => {
    const r = runSolarRoi(BASE_INPUT);
    expect(r.co2AvoidedKgPerYearY1).toBeCloseTo(r.annualProductionKwhY1 * 0.045, 2);
  });

  // 14 ── engineVersion is set
  it("result carries the engine version string", () => {
    const r = runSolarRoi(BASE_INPUT);
    expect(r.engineVersion).toMatch(/^solar-roi@/);
  });
});
