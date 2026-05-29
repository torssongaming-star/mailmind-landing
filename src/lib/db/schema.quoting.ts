/**
 * Drizzle ORM schema — Quoting platform (Phase S0 + S1).
 *
 * Scope landed in S0-1:
 *   • `products`              — global product registry (mail, solar, construction, trades, …)
 *   • `org_product_access`    — per-tenant enablement of a product, status + limits
 *   • `quoting_usage_counters`— per-tenant, per-vertical monthly usage
 *
 * Scope landed in S1-1:
 *   • `quoting_quote_number_sequences` — per-org, per-year atomic OFF-YYYY-NNNN counter
 *   • `quoting_customers`              — universal prospect/customer records
 *   • `quoting_products`               — vertical-tagged catalog items
 *   • `quoting_price_books`            — named, versioned price books
 *   • `quoting_price_book_versions`    — immutable frozen snapshots
 *   • `quoting_quotes`                 — aggregate root with vertical discriminator
 *   • `quoting_quote_lines`            — line items belonging to a quote
 *   • `quoting_workflow_events`        — append-only pipeline history
 *
 * Reasoning (see docs/architecture/quoting-platform-architecture.md §6.2):
 *   The quoting platform supports multiple vertical modules (Solar, Construction,
 *   Trades) sharing a quoting-common library. Universal tables are prefixed
 *   `quoting_*`; vertical extension tables (`solar_*`, etc.) live in their
 *   own schema files added in later phases.
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
  numeric,
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

// ── S1 Enums ──────────────────────────────────────────────────────────────────

/**
 * Status of a price book — `draft` while editing, `published` when active,
 * `archived` when superseded.
 */
export const priceBookStatusEnum = pgEnum("price_book_status", [
  "draft",
  "published",
  "archived",
]);

/**
 * Lifecycle status of a quote. Valid transitions enforced by
 * `lib/quoting-common/domain/quote-state.ts`.
 *
 *   draft       — being assembled
 *   calculating — engine run in progress
 *   ready       — complete, not yet sent
 *   sent        — delivered to end customer
 *   viewed      — customer opened the link
 *   accepted    — customer accepted verbally / clicked
 *   signed      — BankID/e-sign complete (terminal)
 *   rejected    — declined or soft-deleted (terminal)
 *   expired     — validUntil passed (terminal)
 */
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "calculating",
  "ready",
  "sent",
  "viewed",
  "accepted",
  "signed",
  "rejected",
  "expired",
]);

// ── S1 Tables ─────────────────────────────────────────────────────────────────

/**
 * Tracks the last-used sequence number per (org, year) for OFF-YYYY-NNNN
 * quote numbering.  Updated atomically (upsert + RETURNING) so concurrent
 * quote creation within the same org never produces duplicates.
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingQuoteNumberSequences = pgTable(
  "quoting_quote_number_sequences",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    year:           integer("year").notNull(),
    lastUsed:       integer("last_used").notNull().default(0),
  },
  (t) => [
    uniqueIndex("quoting_quote_num_seq_org_year_idx").on(t.organizationId, t.year),
  ],
);

/**
 * Universal prospect/end-customer records shared across all verticals within
 * a tenant. A tenant that sells both solar and construction to the same client
 * reuses the same Customer row across both quoting flows.
 *
 * `sharedContactId` is a future forward-reference to a platform-level
 * `contacts` table (not yet built); left NULL until that table exists.
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingCustomers = pgTable(
  "quoting_customers",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name:            varchar("name", { length: 200 }).notNull(),
    orgNumber:       varchar("org_number", { length: 20 }),
    email:           varchar("email", { length: 254 }),
    phone:           varchar("phone", { length: 40 }),
    address:         jsonb("address").$type<{
      street?: string; city?: string; postalCode?: string; country?: string;
    }>(),
    sharedContactId: uuid("shared_contact_id"),
    meta:            jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("quoting_customers_org_idx").on(t.organizationId),
  ],
);

/**
 * Vertical-tagged catalog items. A product can belong to multiple verticals
 * (e.g. a cable is used in both solar and construction).
 *
 * `cost` is an internal-only field (never emitted to customers) — it populates
 * the calculation engine, not the KB or quote text.
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingProducts = pgTable(
  "quoting_products",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    kind:           varchar("kind", { length: 100 }).notNull(),
    verticals:      jsonb("verticals").$type<string[]>().notNull().default([]),
    sku:            varchar("sku", { length: 100 }),
    name:           varchar("name", { length: 200 }).notNull(),
    spec:           jsonb("spec").$type<Record<string, unknown>>(),
    cost:           numeric("cost", { precision: 12, scale: 2 }),
    active:         boolean("active").notNull().default(true),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("quoting_products_org_idx").on(t.organizationId),
    index("quoting_products_org_kind_idx").on(t.organizationId, t.kind),
  ],
);

/**
 * Named, versioned price lists. A price book is linked to one or more
 * verticals so solar price books stay separate from construction ones.
 *
 * Actual prices live in immutable `quoting_price_book_versions` snapshots.
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingPriceBooks = pgTable(
  "quoting_price_books",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name:           varchar("name", { length: 200 }).notNull(),
    currency:       varchar("currency", { length: 3 }).notNull().default("SEK"),
    status:         priceBookStatusEnum("status").notNull().default("draft"),
    verticals:      jsonb("verticals").$type<string[]>().notNull().default([]),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("quoting_price_books_org_idx").on(t.organizationId),
  ],
);

/**
 * Immutable snapshots of a price book. Once published a version is never
 * mutated — quotes bind to a version so they remain reproducible even when
 * the underlying price book is updated.
 *
 * `items` is a frozen map of productId → { unitPrice, laborRate, vatRate,
 * rotRate, rutRate } serialised at publish time.
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingPriceBookVersions = pgTable(
  "quoting_price_book_versions",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    priceBookId:     uuid("price_book_id").notNull().references(() => quotingPriceBooks.id, { onDelete: "cascade" }),
    version:         integer("version").notNull(),
    effectiveFrom:   date("effective_from").notNull(),
    items:           jsonb("items").$type<Record<string, unknown>>().notNull().default({}),
    publishedAt:     timestamp("published_at", { withTimezone: true }),
    createdBy:       uuid("created_by"),
  },
  (t) => [
    uniqueIndex("quoting_pbv_book_version_idx").on(t.priceBookId, t.version),
    index("quoting_pbv_org_idx").on(t.organizationId),
  ],
);

/**
 * Quote aggregate root — one row per quote, across all verticals.
 *
 * `vertical` is the discriminator ('solar' | 'construction' | 'trades' | …)
 * that identifies which engine + extension data applies. Vertical-specific
 * fields live in the 1:1 extension tables (`solar_quote_extension`, etc.).
 *
 * `number` follows the `OFF-YYYY-NNNN` pattern assigned atomically by
 * `lib/quoting-common/data/quote-number.ts` (S1-3).
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingQuotes = pgTable(
  "quoting_quotes",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    organizationId:      uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    customerId:          uuid("customer_id").references(() => quotingCustomers.id, { onDelete: "set null" }),
    vertical:            varchar("vertical", { length: 50 }).notNull(),
    number:              varchar("number", { length: 20 }),
    status:              quoteStatusEnum("status").notNull().default("draft"),
    priceBookVersionId:  uuid("price_book_version_id").references(() => quotingPriceBookVersions.id, { onDelete: "set null" }),
    currency:            varchar("currency", { length: 3 }).notNull().default("SEK"),
    subtotal:            numeric("subtotal", { precision: 14, scale: 2 }),
    vatAmount:           numeric("vat_amount", { precision: 14, scale: 2 }),
    rotDeduction:        numeric("rot_deduction", { precision: 14, scale: 2 }),
    rutDeduction:        numeric("rut_deduction", { precision: 14, scale: 2 }),
    total:               numeric("total", { precision: 14, scale: 2 }),
    validUntil:          date("valid_until"),
    assignedUserId:      uuid("assigned_user_id"),
    meta:                jsonb("meta").$type<Record<string, unknown>>(),
    createdBy:           uuid("created_by"),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("quoting_quotes_org_idx").on(t.organizationId),
    index("quoting_quotes_org_status_idx").on(t.organizationId, t.status),
    index("quoting_quotes_org_vertical_idx").on(t.organizationId, t.vertical),
  ],
);

/**
 * Line items belonging to a quote. Ordered by `sortOrder`.
 *
 * `productId` is nullable — free-text lines (description only) are allowed.
 * `lineTotal` should equal `qty × unitPrice` (computed at write time for
 * simplicity; no DB-level trigger so the service must maintain consistency).
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingQuoteLines = pgTable(
  "quoting_quote_lines",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId:        uuid("quote_id").notNull().references(() => quotingQuotes.id, { onDelete: "cascade" }),
    productId:      uuid("product_id"),
    description:    varchar("description", { length: 500 }).notNull(),
    qty:            numeric("qty", { precision: 12, scale: 4 }).notNull(),
    unitPrice:      numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    lineTotal:      numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    sortOrder:      integer("sort_order").notNull().default(0),
    meta:           jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("quoting_quote_lines_quote_idx").on(t.quoteId),
    index("quoting_quote_lines_org_idx").on(t.organizationId),
  ],
);

/**
 * Append-only pipeline history. Every status transition writes a row here.
 * Never updated — only inserted. Provides a full audit trail for each quote.
 *
 * Tenant-scoped via `organization_id`.
 */
export const quotingWorkflowEvents = pgTable(
  "quoting_workflow_events",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId:       uuid("quote_id").notNull().references(() => quotingQuotes.id, { onDelete: "cascade" }),
    fromStage:     varchar("from_stage", { length: 50 }),
    toStage:       varchar("to_stage", { length: 50 }).notNull(),
    actorUserId:   uuid("actor_user_id"),
    reason:        varchar("reason", { length: 300 }),
    createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("quoting_workflow_events_quote_idx").on(t.quoteId),
    index("quoting_workflow_events_org_created_idx").on(t.organizationId, t.createdAt),
  ],
);

// ── Inferred types (for application code) ─────────────────────────────────────

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type OrgProductAccess = typeof orgProductAccess.$inferSelect;
export type NewOrgProductAccess = typeof orgProductAccess.$inferInsert;

export type QuotingUsageCounter = typeof quotingUsageCounters.$inferSelect;
export type NewQuotingUsageCounter = typeof quotingUsageCounters.$inferInsert;

// S1 types
export type QuotingQuoteNumberSequence = typeof quotingQuoteNumberSequences.$inferSelect;
export type QuotingCustomer             = typeof quotingCustomers.$inferSelect;
export type NewQuotingCustomer          = typeof quotingCustomers.$inferInsert;
export type QuotingProduct              = typeof quotingProducts.$inferSelect;
export type NewQuotingProduct           = typeof quotingProducts.$inferInsert;
export type QuotingPriceBook            = typeof quotingPriceBooks.$inferSelect;
export type NewQuotingPriceBook         = typeof quotingPriceBooks.$inferInsert;
export type QuotingPriceBookVersion     = typeof quotingPriceBookVersions.$inferSelect;
export type NewQuotingPriceBookVersion  = typeof quotingPriceBookVersions.$inferInsert;
export type QuotingQuote                = typeof quotingQuotes.$inferSelect;
export type NewQuotingQuote             = typeof quotingQuotes.$inferInsert;
export type QuotingQuoteLine            = typeof quotingQuoteLines.$inferSelect;
export type NewQuotingQuoteLine         = typeof quotingQuoteLines.$inferInsert;
export type QuotingWorkflowEvent        = typeof quotingWorkflowEvents.$inferSelect;
export type NewQuotingWorkflowEvent     = typeof quotingWorkflowEvents.$inferInsert;
