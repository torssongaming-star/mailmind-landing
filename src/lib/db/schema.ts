/**
 * Drizzle ORM schema for Mailmind customer portal.
 *
 * WHY DRIZZLE OVER PRISMA:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Edge / serverless compatibility — Prisma's query engine is a native binary
 *    that can't run in Vercel Edge or Cloudflare Workers. Drizzle is pure JS and
 *    works with Neon's HTTP driver anywhere.
 *
 * 2. No generation step — Prisma requires `prisma generate` before every deploy.
 *    Drizzle types are inferred directly from the schema at compile time.
 *
 * 3. Neon-native — @neondatabase/serverless provides an HTTP fetch driver that
 *    handles connection pooling automatically; Drizzle wraps it with zero config.
 *
 * 4. SQL-first — Drizzle stays close to SQL. Queries are explicit, predictable,
 *    and easy to inspect; no magic N+1 or lazy-loading surprises.
 *
 * 5. Bundle size — Drizzle + Neon HTTP adds ~40 KB gzipped vs. ~500 KB for the
 *    Prisma client.
 * ─────────────────────────────────────────────────────────────────────────────
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
import { relations } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

/** User role within an organisation */
export const userRoleEnum = pgEnum("user_role", [
  "owner",   // Full access + billing
  "admin",   // Full access, no billing
  "member",  // Read + limited write
]);

/** Mailmind subscription plans */
export const planEnum = pgEnum("plan", ["starter", "team", "business"]);

/** Stripe subscription lifecycle statuses */
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "incomplete",
  "paused",
]);

// ── Tables ────────────────────────────────────────────────────────────────────

/**
 * organizations
 * One row per paying account (B2B team). A Clerk organisation maps 1:1 to a row
 * here. For solo users, clerkOrgId may be null and we fall back to the user's
 * Clerk user ID as the boundary.
 *
 * TODO (Phase 3): Populate from Clerk organisation webhooks.
 */
export const organizations = pgTable(
  "organizations",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    clerkOrgId:       varchar("clerk_org_id", { length: 255 }).unique(),
    name:             varchar("name", { length: 255 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
    createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("organizations_clerk_org_id_idx").on(t.clerkOrgId),
    uniqueIndex("organizations_stripe_customer_id_idx").on(t.stripeCustomerId),
  ]
);

/**
 * users
 * Individual seats within an organisation. A Clerk user maps 1:1 to a row here.
 * One user per organisation for starters; teams share an org.
 *
 * TODO (Phase 3): Sync from Clerk user webhooks (user.created, user.updated).
 */
export const users = pgTable(
  "users",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    clerkUserId:    varchar("clerk_user_id", { length: 255 }).notNull().unique(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    email:          varchar("email", { length: 320 }).notNull(),
    role:           userRoleEnum("role").notNull().default("member"),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_clerk_user_id_idx").on(t.clerkUserId),
    index("users_organization_id_idx").on(t.organizationId),
  ]
);

/**
 * subscriptions
 * One active subscription per organisation. Stripe is the source of truth;
 * this table is a local cache synced by the Stripe webhook handler.
 *
 * TODO (Phase 3): Populate from Stripe webhook events:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    organizationId:       uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).notNull().unique(),
    stripeCustomerId:     varchar("stripe_customer_id", { length: 255 }).notNull(),
    plan:                 planEnum("plan").notNull(),
    status:               subscriptionStatusEnum("status").notNull(),
    currentPeriodEnd:     timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd:    boolean("cancel_at_period_end").notNull().default(false),
    createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("subscriptions_organization_id_idx").on(t.organizationId),
    uniqueIndex("subscriptions_stripe_sub_id_idx").on(t.stripeSubscriptionId),
  ]
);

/**
 * license_entitlements
 * Resolved limits for the organisation's current plan. Duplicates the PLANS
 * constant in lib/stripe.ts so that billing and usage logic don't need to import
 * frontend code. Updated when the subscription plan changes.
 *
 * TODO (Phase 3): Recalculate on subscription.updated webhook.
 */
export const licenseEntitlements = pgTable(
  "license_entitlements",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    organizationId:      uuid("organization_id").notNull().unique().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    plan:                planEnum("plan").notNull(),
    maxUsers:            integer("max_users").notNull().default(2),
    maxInboxes:          integer("max_inboxes").notNull().default(1),
    maxAiDraftsPerMonth: integer("max_ai_drafts_per_month").notNull().default(500),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("license_entitlements_org_id_idx").on(t.organizationId),
  ]
);

/**
 * usage_counters
 * Rolling monthly counters, keyed by (organization_id, month). One row per
 * org per calendar month. Incremented by API middleware as AI drafts are
 * generated and emails processed.
 *
 * TODO (Phase 3): Wire up API routes to increment counters on each AI action.
 * TODO (Phase 3): Add a scheduled job to reset counters at month start.
 */
export const usageCounters = pgTable(
  "usage_counters",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    organizationId:   uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** YYYY-MM-01 — first day of the billing month */
    month:            date("month").notNull(),
    aiDraftsUsed:     integer("ai_drafts_used").notNull().default(0),
    emailsProcessed:  integer("emails_processed").notNull().default(0),
    createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Unique on (organization_id, month) — required by `onConflictDoUpdate`
    // in queries.incrementAiDrafts. Without this constraint, concurrent draft
    // generations could create duplicate counter rows for the same month.
    uniqueIndex("usage_counters_org_month_idx").on(t.organizationId, t.month),
  ]
);

/**
 * audit_logs
 * Append-only event log for billing and admin actions. No updatedAt — records
 * are never modified after insert. metadata is a JSONB blob for flexible payloads.
 *
 * Examples: subscription_created, plan_changed, seat_added, invoice_paid.
 *
 * TODO (Phase 3): Write to audit_logs from webhook handler and admin actions.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** Nullable — some events are system-generated without a user actor */
    userId:         uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** e.g. "subscription_created" | "plan_changed" | "seat_removed" */
    action:         varchar("action", { length: 100 }).notNull(),
    /** Arbitrary JSON payload for the event */
    metadata:       jsonb("metadata"),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_org_id_idx").on(t.organizationId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users:              many(users),
  subscriptions:      many(subscriptions),
  licenseEntitlement: one(licenseEntitlements, {
    fields: [organizations.id],
    references: [licenseEntitlements.organizationId],
  }),
  usageCounters: many(usageCounters),
  auditLogs:     many(auditLogs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  auditLogs: many(auditLogs),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const licenseEntitlementsRelations = relations(licenseEntitlements, ({ one }) => ({
  organization: one(organizations, {
    fields: [licenseEntitlements.organizationId],
    references: [organizations.id],
  }),
}));

export const usageCountersRelations = relations(usageCounters, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageCounters.organizationId],
    references: [organizations.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type Organization      = typeof organizations.$inferSelect;
export type NewOrganization   = typeof organizations.$inferInsert;
export type User              = typeof users.$inferSelect;
export type NewUser           = typeof users.$inferInsert;
export type Subscription      = typeof subscriptions.$inferSelect;
export type NewSubscription   = typeof subscriptions.$inferInsert;
export type LicenseEntitlement  = typeof licenseEntitlements.$inferSelect;
export type NewLicenseEntitlement = typeof licenseEntitlements.$inferInsert;
export type UsageCounter      = typeof usageCounters.$inferSelect;
export type NewUsageCounter   = typeof usageCounters.$inferInsert;
export type AuditLog          = typeof auditLogs.$inferSelect;
export type NewAuditLog       = typeof auditLogs.$inferInsert;
