/**
 * Drizzle ORM schema — Construction vertical extension tables.
 *
 * Scope:
 *   • `construction_estimate_scenarios` — reproducible estimate output
 *     (versioned, frozen inputs), mirroring solar_roi_scenarios.
 *
 * Tenant-scoped via `organization_id`; cascade on org delete for GDPR.
 * Re-exported from `./schema` via `export * from "./schema.construction"`.
 */

import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./schema";
import { quotingQuotes } from "./schema.quoting";

/**
 * Reproducible construction estimate output. Each run of the estimate engine
 * for a quote appends a new row — the latest row is the current scenario.
 * `engineVersion` pins the calculation; `inputs`/`results` are frozen snapshots.
 */
export const constructionEstimateScenarios = pgTable(
  "construction_estimate_scenarios",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId:        uuid("quote_id").notNull().references(() => quotingQuotes.id, { onDelete: "cascade" }),
    engineVersion:  varchar("engine_version", { length: 50 }).notNull(),
    inputs:         jsonb("inputs").$type<Record<string, unknown>>().notNull(),
    results:        jsonb("results").$type<Record<string, unknown>>().notNull(),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("construction_estimate_scenarios_quote_idx").on(t.quoteId),
    index("construction_estimate_scenarios_org_idx").on(t.organizationId),
  ],
);

export type ConstructionEstimateScenario    = typeof constructionEstimateScenarios.$inferSelect;
export type NewConstructionEstimateScenario = typeof constructionEstimateScenarios.$inferInsert;
