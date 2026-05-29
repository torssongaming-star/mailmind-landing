/**
 * Drizzle ORM schema — Solar vertical extension tables (Phase S2).
 *
 * Scope:
 *   • `solar_properties`       — per-customer installation site + roof surfaces
 *   • `solar_quote_extension`  — 1:1 extension to quoting_quotes for solar-specific fields
 *   • `solar_roi_scenarios`    — reproducible engine output (versioned, frozen inputs)
 *
 * All tables are `organizationId`-scoped (Mailmind multi-tenant invariant).
 * Cascade on org delete for GDPR compliance.
 *
 * Re-exported from `./schema` via `export * from "./schema.solar"`.
 */

import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./schema";
import { quotingCustomers, quotingQuotes } from "./schema.quoting";

// ── Shared types ──────────────────────────────────────────────────────────────

/**
 * A single roof segment (surface) on a property.
 * Used in `roofSurfaces` jsonb column of `solar_properties`.
 *
 * All angles in degrees:
 *   tilt    — 0 = flat, 90 = vertical
 *   azimuth — 180 = south, 90 = east, 270 = west, 0/360 = north
 *   shading — fraction of production lost: 0 = no shading, 1 = fully shaded
 */
export type RoofSurface = {
  area:     number; // m²
  tilt:     number; // degrees
  azimuth:  number; // degrees
  shading:  number; // 0–1
  label?:   string; // optional display name e.g. "Takyta söder"
};

// ── Tables ────────────────────────────────────────────────────────────────────

/**
 * A customer's installation property (building + roof surfaces).
 * One customer can have multiple properties (e.g. several addresses).
 *
 * `roofSurfaces` is a jsonb array of RoofSurface objects — the full
 * geometric description fed into the ROI engine.
 *
 * `imagerySource` / `imageryRef` reserved for future satellite imagery
 * integration (S8).
 *
 * Tenant-scoped via `organization_id`.
 */
export const solarProperties = pgTable(
  "solar_properties",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    customerId:     uuid("customer_id").references(() => quotingCustomers.id, { onDelete: "set null" }),
    address:        jsonb("address").$type<{
      street?: string; city?: string; postalCode?: string; country?: string;
    }>(),
    roofSurfaces:   jsonb("roof_surfaces").$type<RoofSurface[]>().notNull().default([]),
    imagerySource:  varchar("imagery_source", { length: 50 }),
    imageryRef:     jsonb("imagery_ref").$type<Record<string, unknown>>(),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("solar_properties_org_idx").on(t.organizationId),
    index("solar_properties_customer_idx").on(t.customerId),
  ],
);

/**
 * 1:1 extension of quoting_quotes for solar-specific fields.
 * The unique constraint on quoteId enforces the 1:1 relationship.
 *
 * `meta` holds solar-specific quote attributes (system size kWp,
 * battery included, installer notes, etc.) as a flexible jsonb bag
 * until we need to promote individual fields to columns.
 *
 * Tenant-scoped via `organization_id`.
 */
export const solarQuoteExtension = pgTable(
  "solar_quote_extension",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId:        uuid("quote_id").notNull().references(() => quotingQuotes.id, { onDelete: "cascade" }),
    propertyId:     uuid("property_id").references(() => solarProperties.id, { onDelete: "set null" }),
    meta:           jsonb("meta").$type<Record<string, unknown>>(),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("solar_quote_extension_quote_idx").on(t.quoteId),
    index("solar_quote_extension_org_idx").on(t.organizationId),
  ],
);

/**
 * Reproducible engine output. Each run of the ROI engine for a quote
 * appends a new row — the latest row is the current scenario.
 *
 * `engineVersion` pins the calculation to an exact engine release so
 * re-opening a quote in 2028 yields the same numbers as in 2026.
 *
 * `inputs` is the frozen input snapshot (all fields of SolarEngineInput).
 * `results` is the frozen output (all fields of SolarEngineResult).
 *
 * Tenant-scoped via `organization_id`.
 */
export const solarRoiScenarios = pgTable(
  "solar_roi_scenarios",
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
    index("solar_roi_scenarios_quote_idx").on(t.quoteId),
    index("solar_roi_scenarios_org_idx").on(t.organizationId),
  ],
);

// ── Inferred types ─────────────────────────────────────────────────────────────

export type SolarProperty           = typeof solarProperties.$inferSelect;
export type NewSolarProperty        = typeof solarProperties.$inferInsert;
export type SolarQuoteExtension     = typeof solarQuoteExtension.$inferSelect;
export type NewSolarQuoteExtension  = typeof solarQuoteExtension.$inferInsert;
export type SolarRoiScenario        = typeof solarRoiScenarios.$inferSelect;
export type NewSolarRoiScenario     = typeof solarRoiScenarios.$inferInsert;
