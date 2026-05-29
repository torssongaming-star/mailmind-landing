/**
 * Solar ROI engine — pure deterministic calculation function.
 *
 * No I/O. No side effects. Inputs are Zod-validated before calling (see types.ts).
 * Version-pinned: bump ENGINE_VERSION in types.ts when logic changes.
 *
 * Production model: kWp-based with SE (59°N) geometry correction tables.
 * Self-consumption: Quaschning approximation.
 * Economics: avoided cost + feed-in + ROT deduction.
 * NPV / IRR: standard discounted cash-flow, IRR by bisection.
 */

import type { SolarEngineInput, SolarEngineResult, YearlyDataPoint } from "./types";
import { ENGINE_VERSION } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Base specific yield at optimal orientation (south 180°, tilt 40°) for ~59°N */
const SE_BASE_SPECIFIC_YIELD = 980; // kWh/kWp/yr

/** Swedish grid CO₂ emission factor (hydro + nuclear dominated mix) */
const CO2_KG_PER_KWH = 0.045;

// ── Correction tables ─────────────────────────────────────────────────────────
// Source: simplified from PVGIS SARAH-3 data for Stockholm (59.3°N, 18.1°E).

/** Tilt (0–90°) → yield factor relative to optimal 40° south-facing surface */
const TILT_TABLE: [number, number][] = [
  [0,  0.875],
  [15, 0.965],
  [30, 0.993],
  [40, 1.000],
  [50, 0.990],
  [60, 0.957],
  [75, 0.880],
  [90, 0.740],
];

/**
 * Azimuth deviation from south (0 = south, 90 = east/west, 180 = north)
 * → yield factor.  Computed as |azimuth − 180| before lookup.
 */
const AZIMUTH_TABLE: [number, number][] = [
  [0,   1.000],
  [15,  0.999],
  [30,  0.990],
  [45,  0.970],
  [60,  0.935],
  [90,  0.880],
  [135, 0.765],
  [180, 0.670],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

/**
 * Area-weighted geometry factor across all roof surfaces.
 * Combines tilt × azimuth × (1 − shading) for each segment.
 *
 * Note: panelEfficiency is embedded in kWp rating and therefore not
 * re-applied here — it is stored on SolarEngineInput for display and
 * area cross-check purposes only.
 */
function weightedGeometryFactor(surfaces: SolarEngineInput["surfaces"]): number {
  const totalArea = surfaces.reduce((s, surf) => s + surf.area, 0);
  if (totalArea === 0) return 1;

  let factor = 0;
  for (const surf of surfaces) {
    const tiltF  = lerp(TILT_TABLE, surf.tilt);
    const azDev  = Math.abs(surf.azimuth - 180); // south → 0 deviation
    const azF    = lerp(AZIMUTH_TABLE, azDev);
    const shadeF = 1 - surf.shading;
    factor += (surf.area / totalArea) * tiltF * azF * shadeF;
  }
  return factor;
}

/**
 * Self-consumption fraction of production (Quaschning 2013 approximation):
 *   sc = 1 / (1 + 1.5 × production / consumption)
 *
 * Returns fraction of annual production that is consumed on-site.
 */
function selfConsumptionFrac(productionKwh: number, consumptionKwh: number): number {
  if (productionKwh <= 0) return 0;
  return Math.min(1, 1 / (1 + 1.5 * (productionKwh / consumptionKwh)));
}

/**
 * Net present value.
 * cashFlows[i] = end-of-year (i+1) cash flow.
 */
function calcNpv(investment: number, cashFlows: number[], r: number): number {
  return cashFlows.reduce(
    (pv, cf, i) => pv + cf / Math.pow(1 + r, i + 1),
    -investment,
  );
}

/**
 * Internal rate of return via bisection (100 iterations, ε < 1e-6).
 * Returns null if the undiscounted sum never exceeds the investment.
 */
function calcIrr(investment: number, cashFlows: number[]): number | null {
  const totalCf = cashFlows.reduce((s, v) => s + v, 0);
  if (totalCf <= investment) return null;

  const f = (r: number) => calcNpv(investment, cashFlows, r);
  if (f(0) < 0) return null;

  let lo = 0;
  let hi = 10; // cap search at 1000 %
  if (f(hi) > 0) return hi;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
    if (hi - lo < 1e-6) return mid;
  }
  return (lo + hi) / 2;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runSolarRoi(input: SolarEngineInput): SolarEngineResult {
  const {
    surfaces,
    systemLossFraction,
    systemCapacityKwp,
    annualConsumptionKwh,
    electricityPriceSekPerKwh,
    feedInTariffSekPerKwh,
    systemCostSek,
    includeRot,
    rotLaborFraction,
    rotPercentage,
    rotMaxSek,
    degradationRatePerYear,
    analysisYears,
    discountRate,
  } = input;

  // 1 ── Year-1 gross production
  const geoFactor              = weightedGeometryFactor(surfaces);
  const annualProductionKwhY1  =
    systemCapacityKwp * SE_BASE_SPECIFIC_YIELD * geoFactor * (1 - systemLossFraction);

  // 2 ── Year-1 self-consumption split
  const scFrac               = selfConsumptionFrac(annualProductionKwhY1, annualConsumptionKwh);
  const selfConsumptionKwhY1 = scFrac * annualProductionKwhY1;
  const feedInKwhY1          = annualProductionKwhY1 - selfConsumptionKwhY1;
  const selfConsumptionRate  = annualProductionKwhY1 > 0
    ? selfConsumptionKwhY1 / annualProductionKwhY1
    : 0;

  // 3 ── Year-1 savings
  const annualSavingsSekY1 =
    selfConsumptionKwhY1 * electricityPriceSekPerKwh +
    feedInKwhY1          * feedInTariffSekPerKwh;

  // 4 ── ROT deduction (Swedish skattereduktion för ROT-arbete)
  const rotDeductionSek  = includeRot
    ? Math.min(systemCostSek * rotLaborFraction * rotPercentage, rotMaxSek)
    : 0;
  const netSystemCostSek = systemCostSek - rotDeductionSek;

  // 5 ── Simple payback
  const paybackYears = annualSavingsSekY1 > 0
    ? netSystemCostSek / annualSavingsSekY1
    : Infinity;

  // 6 ── Yearly breakdown (degradation applied from year 2 onward)
  const yearlyData: YearlyDataPoint[] = [];
  const cashFlows: number[]           = [];
  let   cumulative                    = 0;

  for (let yr = 1; yr <= analysisYears; yr++) {
    const degFactor = Math.pow(1 - degradationRatePerYear, yr - 1);
    const prodKwh   = annualProductionKwhY1 * degFactor;
    const scFr      = selfConsumptionFrac(prodKwh, annualConsumptionKwh);
    const scKwh     = scFr * prodKwh;
    const fiKwh     = prodKwh - scKwh;
    const savings   =
      scKwh * electricityPriceSekPerKwh + fiKwh * feedInTariffSekPerKwh;

    cumulative += savings;
    yearlyData.push({
      year:                 yr,
      productionKwh:        prodKwh,
      selfConsumptionKwh:   scKwh,
      feedInKwh:            fiKwh,
      annualSavingsSek:     savings,
      cumulativeSavingsSek: cumulative,
    });
    cashFlows.push(savings);
  }

  // 7 ── NPV
  const npv = calcNpv(netSystemCostSek, cashFlows, discountRate);

  // 8 ── IRR
  const irr = calcIrr(netSystemCostSek, cashFlows);

  // 9 ── CO₂
  const co2AvoidedKgPerYearY1 = annualProductionKwhY1 * CO2_KG_PER_KWH;

  return {
    engineVersion:           ENGINE_VERSION,
    annualProductionKwhY1,
    selfConsumptionKwhY1,
    feedInKwhY1,
    selfConsumptionRate,
    annualSavingsSekY1,
    rotDeductionSek,
    netSystemCostSek,
    paybackYears,
    npv,
    irr,
    co2AvoidedKgPerYearY1,
    yearlyData,
  };
}
