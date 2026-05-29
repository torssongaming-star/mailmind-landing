/**
 * Construction — estimate scenarios data layer.
 *
 * Append-only audit trail mirroring solar's solar_roi_scenarios: each estimate
 * run appends a frozen row (engine version + inputs + results). The latest row
 * is the current estimate. Rows are never mutated. All ops org-scoped.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { constructionEstimateScenarios } from "@/lib/db/schema";
import type { ConstructionEstimateInput, ConstructionEstimateResult } from "@/lib/construction/engine/types";

export type ConstructionEstimateScenarioRow = typeof constructionEstimateScenarios.$inferSelect;

/** All scenarios for a quote, newest first. */
export async function listEstimateScenarios(
  orgId: string,
  quoteId: string,
): Promise<ConstructionEstimateScenarioRow[]> {
  return db
    .select()
    .from(constructionEstimateScenarios)
    .where(and(
      eq(constructionEstimateScenarios.organizationId, orgId),
      eq(constructionEstimateScenarios.quoteId, quoteId),
    ))
    .orderBy(desc(constructionEstimateScenarios.createdAt));
}

/** Latest scenario for a quote, or null. */
export async function getLatestEstimateScenario(
  orgId: string,
  quoteId: string,
): Promise<ConstructionEstimateScenarioRow | null> {
  const rows = await db
    .select()
    .from(constructionEstimateScenarios)
    .where(and(
      eq(constructionEstimateScenarios.organizationId, orgId),
      eq(constructionEstimateScenarios.quoteId, quoteId),
    ))
    .orderBy(desc(constructionEstimateScenarios.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Append a frozen estimate run. */
export async function saveEstimateScenario(
  orgId: string,
  quoteId: string,
  engineVersion: string,
  inputs: ConstructionEstimateInput,
  results: ConstructionEstimateResult,
): Promise<ConstructionEstimateScenarioRow> {
  const rows = await db
    .insert(constructionEstimateScenarios)
    .values({
      organizationId: orgId,
      quoteId,
      engineVersion,
      inputs:  inputs  as Record<string, unknown>,
      results: results as Record<string, unknown>,
    })
    .returning();
  return rows[0];
}
