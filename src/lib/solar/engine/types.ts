/**
 * Solar ROI engine — input/output types and Zod schemas.
 *
 * Client-safe: no server-only imports. Used by the engine, API routes, and UI.
 */

import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Pinned engine version. Bump when calculation logic changes. */
export const ENGINE_VERSION = "solar-roi@1.0.0";

// ── Roof surface ──────────────────────────────────────────────────────────────

export const RoofSurfaceInputSchema = z.object({
  /** Area of this roof segment in m² */
  area:    z.number().positive(),
  /** Tilt angle in degrees: 0 = flat, 90 = vertical */
  tilt:    z.number().min(0).max(90),
  /** Azimuth in degrees: 180 = south, 90 = east, 270 = west */
  azimuth: z.number().min(0).max(360),
  /** Shading fraction 0–1: 0 = no shade, 1 = fully shaded */
  shading: z.number().min(0).max(1),
  /** Optional human label */
  label:   z.string().optional(),
});

export type RoofSurfaceInput = z.infer<typeof RoofSurfaceInputSchema>;

// ── Engine input ──────────────────────────────────────────────────────────────

export const SolarEngineInputSchema = z.object({
  /** Roof surfaces to include in the calculation */
  surfaces: z.array(RoofSurfaceInputSchema).min(1),

  /** System-level losses (wiring, inverter, temperature) — fraction 0–1 */
  systemLossFraction: z.number().min(0).max(0.5).default(0.14),

  /** Panel efficiency as fraction — e.g. 0.21 for 21% efficient panels */
  panelEfficiency: z.number().min(0.10).max(0.30).default(0.21),

  /** Installed capacity in kWp */
  systemCapacityKwp: z.number().positive(),

  /** Annual household/business electricity consumption in kWh */
  annualConsumptionKwh: z.number().positive(),

  /** Current electricity purchase price in SEK/kWh (incl. taxes) */
  electricityPriceSekPerKwh: z.number().positive().default(1.80),

  /** Feed-in tariff for exported energy in SEK/kWh */
  feedInTariffSekPerKwh: z.number().min(0).default(0.65),

  /** Total installed system cost in SEK (before ROT) */
  systemCostSek: z.number().positive(),

  /** Include Swedish ROT deduction in payback calculation */
  includeRot: z.boolean().default(true),

  /**
   * ROT applies to 30 % of the labor cost. As a simplification we treat
   * rotLaborFraction of systemCostSek as labor (default 0.40 = 40%).
   */
  rotLaborFraction: z.number().min(0).max(1).default(0.40),

  /** ROT deduction rate — 30 % per Swedish tax law 2025 */
  rotPercentage: z.number().min(0).max(1).default(0.30),

  /**
   * Maximum ROT deduction per person for the year (currently 50 000 SEK).
   * For households with two adults, pass 100 000.
   */
  rotMaxSek: z.number().positive().default(50000),

  /** Annual panel degradation rate — fraction per year */
  degradationRatePerYear: z.number().min(0).max(0.02).default(0.005),

  /** Number of years for NPV / IRR analysis */
  analysisYears: z.number().int().min(5).max(40).default(20),

  /** Discount rate for NPV calculation */
  discountRate: z.number().min(0).max(0.20).default(0.04),
});

export type SolarEngineInput = z.infer<typeof SolarEngineInputSchema>;

// ── Engine result ─────────────────────────────────────────────────────────────

export type YearlyDataPoint = {
  year:               number;
  productionKwh:      number;
  selfConsumptionKwh: number;
  feedInKwh:          number;
  annualSavingsSek:   number;
  cumulativeSavingsSek: number;
};

export type SolarEngineResult = {
  /** Pinned version of the engine that produced this result */
  engineVersion: string;

  /** Year-1 gross production in kWh */
  annualProductionKwhY1: number;

  /** Year-1 self-consumed energy in kWh */
  selfConsumptionKwhY1: number;

  /** Year-1 energy exported to grid in kWh */
  feedInKwhY1: number;

  /** Self-consumption as fraction of production (year 1) */
  selfConsumptionRate: number;

  /** Year-1 annual savings in SEK (avoided cost + feed-in revenue) */
  annualSavingsSekY1: number;

  /** ROT deduction in SEK (0 if includeRot=false) */
  rotDeductionSek: number;

  /** Net system cost after ROT deduction */
  netSystemCostSek: number;

  /** Simple payback period in years (netSystemCost / Y1 savings) */
  paybackYears: number;

  /** Net present value over analysisYears at discountRate */
  npv: number;

  /** Internal rate of return (annual) — null if not converged */
  irr: number | null;

  /** CO₂ avoided per year in kg (Y1) */
  co2AvoidedKgPerYearY1: number;

  /** Detailed yearly breakdown */
  yearlyData: YearlyDataPoint[];
};
