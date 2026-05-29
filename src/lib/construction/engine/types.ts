/**
 * Construction estimate engine — input/output types and Zod schemas.
 *
 * Client-safe: no server-only imports. Mirrors the shape of the Solar engine
 * (pure deterministic function, pinned version) so the quoting-common kernel
 * treats every vertical identically.
 *
 * The model is deliberately simple for the MVP: material + labour, Swedish VAT,
 * and ROT deduction on the labour portion. It exists to prove the multi-vertical
 * kernel — a richer cost model (assemblies, waste factors, regional rates) can
 * replace the body without changing the contract.
 */

import { z } from "zod";

/** Pinned engine version. Bump when calculation logic changes. */
export const CONSTRUCTION_ENGINE_VERSION = "construction-estimate@1.0.0";

// ── Engine input ──────────────────────────────────────────────────────────────

export const ConstructionEstimateInputSchema = z.object({
  /** Free-text project type for the quote narrative (e.g. "Badrumsrenovering"). */
  projectType: z.string().min(1).max(120),

  /** Floor/work area in m². */
  areaM2: z.number().positive(),

  /** Material cost per m² in SEK (excl. VAT). */
  materialCostSekPerM2: z.number().min(0),

  /** Estimated labour hours. */
  labourHours: z.number().min(0),

  /** Labour rate in SEK/hour (excl. VAT). */
  labourRateSekPerHour: z.number().min(0).default(650),

  /** Swedish VAT rate — 25 % standard. */
  vatRate: z.number().min(0).max(0.5).default(0.25),

  /** Include ROT deduction (private customers). */
  includeRot: z.boolean().default(true),

  /** ROT rate — 30 % of labour cost per Swedish tax law 2025. */
  rotPercentage: z.number().min(0).max(1).default(0.30),

  /** Max ROT deduction per person/year (50 000 SEK; pass 100 000 for two adults). */
  rotMaxSek: z.number().positive().default(50000),
});

export type ConstructionEstimateInput = z.infer<typeof ConstructionEstimateInputSchema>;

// ── Engine result ─────────────────────────────────────────────────────────────

export type ConstructionEstimateResult = {
  /** Pinned version of the engine that produced this result. */
  engineVersion: string;

  /** Material cost (excl. VAT) in SEK. */
  materialCostSek: number;

  /** Labour cost (excl. VAT) in SEK. */
  labourCostSek: number;

  /** Subtotal before VAT (material + labour). */
  subtotalSek: number;

  /** VAT amount in SEK. */
  vatSek: number;

  /** ROT deduction in SEK (0 if includeRot=false). */
  rotDeductionSek: number;

  /** Final total the customer pays (subtotal + VAT − ROT). */
  totalSek: number;
};
