/**
 * Construction estimate engine — pure deterministic function.
 *
 * No I/O, no imports from @/lib/db or @/lib/app (enforced by ESLint Rule 4).
 * Given validated inputs it returns a frozen cost breakdown. Same input →
 * same output, always — so results can be persisted and reproduced.
 */

import {
  CONSTRUCTION_ENGINE_VERSION,
  type ConstructionEstimateInput,
  type ConstructionEstimateResult,
} from "./types";

/** Round to whole SEK to avoid floating-point noise in persisted results. */
function roundSek(n: number): number {
  return Math.round(n);
}

export function runConstructionEstimate(
  input: ConstructionEstimateInput,
): ConstructionEstimateResult {
  const materialCostSek = roundSek(input.areaM2 * input.materialCostSekPerM2);
  const labourCostSek   = roundSek(input.labourHours * input.labourRateSekPerHour);
  const subtotalSek     = materialCostSek + labourCostSek;
  const vatSek          = roundSek(subtotalSek * input.vatRate);

  // ROT applies to the labour portion only (incl. its VAT, per Skatteverket),
  // capped at rotMaxSek. The MVP applies the rate to the ex-VAT labour cost —
  // a conservative under-estimate the salesperson can refine.
  let rotDeductionSek = 0;
  if (input.includeRot) {
    rotDeductionSek = Math.min(
      roundSek(labourCostSek * input.rotPercentage),
      input.rotMaxSek,
    );
  }

  const totalSek = subtotalSek + vatSek - rotDeductionSek;

  return {
    engineVersion: CONSTRUCTION_ENGINE_VERSION,
    materialCostSek,
    labourCostSek,
    subtotalSek,
    vatSek,
    rotDeductionSek,
    totalSek,
  };
}
