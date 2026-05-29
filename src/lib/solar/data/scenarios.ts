/**
 * Solar — ROI scenarios data layer.
 *
 * Each call to the ROI engine appends a new row. The latest row is the
 * current scenario for a quote. Rows are never mutated — immutable audit trail.
 * All operations are scoped by `organizationId`.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { solarRoiScenarios } from "@/lib/db/schema";
import type { SolarEngineInput, SolarEngineResult } from "@/lib/solar/engine/types";

export type SolarRoiScenarioRow = typeof solarRoiScenarios.$inferSelect;

// ── Queries ───────────────────────────────────────────────────────────────────

/** All scenarios for a quote, newest first. */
export async function listScenariosForQuote(
  orgId:   string,
  quoteId: string,
): Promise<SolarRoiScenarioRow[]> {
  return db
    .select()
    .from(solarRoiScenarios)
    .where(
      and(
        eq(solarRoiScenarios.organizationId, orgId),
        eq(solarRoiScenarios.quoteId, quoteId),
      ),
    )
    .orderBy(desc(solarRoiScenarios.createdAt));
}

/** Latest scenario for a quote, or null if none exist. */
export async function getLatestScenario(
  orgId:   string,
  quoteId: string,
): Promise<SolarRoiScenarioRow | null> {
  const rows = await db
    .select()
    .from(solarRoiScenarios)
    .where(
      and(
        eq(solarRoiScenarios.organizationId, orgId),
        eq(solarRoiScenarios.quoteId, quoteId),
      ),
    )
    .orderBy(desc(solarRoiScenarios.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Persist a frozen engine run. Never call this without first validating
 * inputs through `SolarEngineInputSchema.parse()`.
 */
export async function saveScenario(
  orgId:         string,
  quoteId:       string,
  engineVersion: string,
  inputs:        SolarEngineInput,
  results:       SolarEngineResult,
): Promise<SolarRoiScenarioRow> {
  const rows = await db
    .insert(solarRoiScenarios)
    .values({
      organizationId: orgId,
      quoteId,
      engineVersion,
      inputs:         inputs  as Record<string, unknown>,
      results:        results as Record<string, unknown>,
    })
    .returning();
  return rows[0];
}
