/**
 * Drizzle ORM schema — Quoting platform foundations (Phase S0).
 *
 * Scope landed in S0-1:
 *   • `products`              — global product registry (mail, solar, construction, trades, …)
 *   • `org_product_access`    — per-tenant enablement of a product, status + limits
 *   • `quoting_usage_counters`— per-tenant, per-vertical monthly usage
 *
 * Reasoning (see docs/architecture/quoting-platform-architecture.md §6.4 and §15):
 *   The quoting platform supports multiple vertical modules (Solar, Construction,
 *   Trades) sharing a quoting-common library. Product enablement and usage are
 *   tracked here in the platform layer; vertical-specific tables (solar_*,
 *   construction_*, trades_*) live in their own schema files added in later phases.
 *
 * Re-exported from `./schema` so Drizzle sees all tables in one schema object.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./schema";

// ── Enums ─────────────────────────────────────────────────────────────────────

/**
 * Status of a tenant's access to a product.
 *   trialing  — within trial window, full access
 *   active    — fully enabled, billing healthy
 *   disabled  — explicitly turned off (cancellation, admin action)
 *
 * Mapped to entitlement decisions in `lib/app/entitlements.ts` via
 * `getProductAccess` / `hasProductAccess` (added in task S0-2).
 */
export const productAccessStatusEnum = pgEnum("product_access_status", [
  "trialing",
  "active",
  "disabled",
]);

// ── Tables ────────────────────────────────────────────────────────────────────

/**
 * Global product registry. Seeded (in S0-3) with the known platform products.
 * Acts as the foreign-key target for `org_product_access.product_key`.
 *
 * NOT tenant-scoped — this is a platform-wide registry.
 */
export const products = pgTable(
  "products",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    key:       varchar("key", { length: 50 }).notNull().unique(),
    name:      varchar("name", { length: 100 }).notNull(),
    active:    boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("products_key_idx").on(t.key),
  ],
);

/**
 * Per-org enablement of a product. One row per (organization, productKey).
 * Drives `hasProductAccess(account, productKey)` gating in routes and UI.
 *
 * `limits` is product-specific (e.g. `{ maxQuotesPerMonth: 50 }` for solar);
 * shape is owned by the product module that reads it, not by this table.
 *
 * Tenant-scoped via `organization_id` (Mailmind invariant).
 */
export const orgProductAccess = pgTable(
  "org_product_access",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    productKey:     varchar("product_key", { length: 50 }).notNull().references(() => products.key, { onDelete: "cascade" }),
    status:         productAccessStatusEnum("status").notNull().default("trialing"),
    limits:         jsonb("limits").$type<Record<string, number>>().notNull().default({}),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("org_product_access_org_product_idx").on(t.organizationId, t.productKey),
    index("org_product_access_org_idx").on(t.organizationId),
  ],
);

/**
 * Per-org, per-vertical monthly usage counters for the quoting platform.
 * One row per (organizationId, month, vertical) tuple.
 *
 * Mirrors the existing `usage_counters` (mail) pattern. `vertical` is varchar
 * (not enum) so adding future verticals — e.g. 'roofing', 'painting' — does
 * not require an ALTER TYPE migration. See project-state.md (ALTER TYPE gotcha).
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingUsageCounters = pgTable(
  "quoting_usage_counters",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    month:           date("month").notNull(),
    vertical:        varchar("vertical", { length: 50 }).notNull(),
    quotesCreated:   integer("quotes_created").notNull().default(0),
    pdfsGenerated:   integer("pdfs_generated").notNull().default(0),
    engineCalcs:     integer("engine_calcs").notNull().default(0),
    aiAuthoringRuns: integer("ai_authoring_runs").notNull().default(0),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("quoting_usage_counters_org_month_vertical_idx").on(
      t.organizationId,
      t.month,
      t.vertical,
    ),
    index("quoting_usage_counters_org_idx").on(t.organizationId),
  ],
);

// ── Inferred types (for application code) ─────────────────────────────────────

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type OrgProductAccess = typeof orgProductAccess.$inferSelect;
export type NewOrgProductAccess = typeof orgProductAccess.$inferInsert;

export type QuotingUsageCounter = typeof quotingUsageCounters.$inferSelect;
export type NewQuotingUsageCounter = typeof quotingUsageCounters.$inferInsert;
