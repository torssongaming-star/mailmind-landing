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
  text,
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

// ── App enums (Phase 2 — email triage) ────────────────────────────────────────

/** AI reply tone */
export const aiToneEnum = pgEnum("ai_tone", ["formal", "friendly", "neutral"]);

/** Email inbox provider type */
export const inboxProviderEnum = pgEnum("inbox_provider", [
  "mailmind", // hosted forwarder — customer forwards to <slug>@mail.mailmind.se
  "imap",
  "gmail",
  "outlook",
]);

/** Inbox connection lifecycle */
export const inboxStatusEnum = pgEnum("inbox_status", [
  "connecting",
  "active",
  "error",
  "paused",
]);

/** Email thread lifecycle */
export const threadStatusEnum = pgEnum("thread_status", [
  "open",       // new, no AI action yet
  "waiting",    // AI replied, awaiting customer
  "escalated",  // routed to human
  "resolved",   // closed
]);

/** Who sent a given message */
export const messageRoleEnum = pgEnum("message_role", [
  "customer", // inbound from external sender
  "assistant", // AI-generated reply
  "agent",    // sent by team member manually
]);

/** AI's chosen action for a draft */
export const draftActionEnum = pgEnum("draft_action", [
  "ask",       // ask customer for more info
  "summarize", // all info collected, route to team
  "escalate",  // unclear / out of scope
]);

/** AI draft review state */
export const draftStatusEnum = pgEnum("draft_status", [
  "pending",   // generated, awaiting review
  "approved",  // human approved as-is
  "edited",    // human approved with edits
  "sent",      // dispatched to customer
  "rejected",  // human rejected — won't be sent
]);

/** Internal Mailmind admin customer status */
export const adminCustomerStatusEnum = pgEnum("admin_customer_status", [
  "internal_test",
  "pilot",
  "active_customer",
  "enterprise_lead",
  "enterprise_customer",
  "churned",
]);

/** Status for internal knowledge base articles */
export const adminKnowledgeStatusEnum = pgEnum("admin_knowledge_status", [
  "draft",
  "published",
  "archived",
]);

/** Categories for internal knowledge base articles */
export const adminKnowledgeCategoryEnum = pgEnum("admin_knowledge_category", [
  "enterprise",
  "gdpr",
  "security",
  "dpa",
  "ai_policy",
  "pilot",
  "support",
  "billing",
  "onboarding",
  "internal_process",
  "other",
]);

/** Type of subject an admin note is attached to */
export const adminNoteSubjectTypeEnum = pgEnum("admin_note_subject_type", [
  "user",
  "organization",
  "enterprise",
  "general",
]);

// ── Tables ────────────────────────────────────────────────────────────────────

/**
 * admin_knowledge_articles
 * Internal CMS for Mailmind team knowledge base.
 */
export const adminKnowledgeArticles = pgTable(
  "admin_knowledge_articles",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),
    title:                  varchar("title", { length: 255 }).notNull(),
    slug:                   varchar("slug", { length: 255 }).notNull().unique(),
    summary:                text("summary"),
    content:                text("content").notNull(),
    category:               adminKnowledgeCategoryEnum("category").notNull().default("other"),
    status:                 adminKnowledgeStatusEnum("status").notNull().default("draft"),
    tags:                   jsonb("tags").$type<string[]>().default([]),
    authorClerkUserId:      varchar("author_clerk_user_id", { length: 255 }).notNull(),
    authorEmail:            varchar("author_email", { length: 320 }),
    updatedByClerkUserId:   varchar("updated_by_clerk_user_id", { length: 255 }),
    updatedByEmail:         varchar("updated_by_email", { length: 320 }),
    publishedAt:            timestamp("published_at", { withTimezone: true }),
    archivedAt:             timestamp("archived_at", { withTimezone: true }),
    createdAt:              timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:              timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("admin_knowledge_articles_slug_idx").on(t.slug),
    index("admin_knowledge_articles_category_idx").on(t.category),
    index("admin_knowledge_articles_status_idx").on(t.status),
  ]
);

/**
 * admin_customer_profiles
 * Internal tracking for pilots, enterprise leads, and testing accounts.
 * Separated from core org data to avoid cluttering the customer experience.
 */
export const adminCustomerProfiles = pgTable(
  "admin_customer_profiles",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    organizationId:     uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    clerkUserId:        varchar("clerk_user_id", { length: 255 }),
    status:             adminCustomerStatusEnum("status").notNull().default("internal_test"),
    ownerName:          varchar("owner_name", { length: 255 }),
    contactName:        varchar("contact_name", { length: 255 }),
    contactEmail:       varchar("contact_email", { length: 320 }),
    startDate:          timestamp("start_date", { withTimezone: true }),
    nextFollowUpAt:     timestamp("next_follow_up_at", { withTimezone: true }),
    summary:            text("summary"),
    createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("admin_customer_profiles_org_id_idx").on(t.organizationId),
    index("admin_customer_profiles_status_idx").on(t.status),
  ]
);

/**
 * admin_notes
 * Internal team commentary on users, organizations, or enterprise leads.
 */
export const adminNotes = pgTable(
  "admin_notes",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    subjectType:          adminNoteSubjectTypeEnum("subject_type").notNull(),
    targetClerkUserId:    varchar("target_clerk_user_id", { length: 255 }),
    targetOrganizationId: uuid("target_organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    authorClerkUserId:    varchar("author_clerk_user_id", { length: 255 }).notNull(),
    content:              text("content").notNull(),
    createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:            timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("admin_notes_target_user_idx").on(t.targetClerkUserId),
    index("admin_notes_target_org_idx").on(t.targetOrganizationId),
  ]
);

/**
 * admin_audit_logs
 * Dedicated append-only log for all administrative actions.
 */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    actorClerkUserId:     varchar("actor_clerk_user_id", { length: 255 }).notNull(),
    actorEmail:           varchar("actor_email", { length: 320 }).notNull(),
    action:               varchar("action", { length: 100 }).notNull(),
    targetType:           varchar("target_type", { length: 50 }),
    targetClerkUserId:    varchar("target_clerk_user_id", { length: 255 }),
    targetOrganizationId: uuid("target_organization_id"),
    metadata:             jsonb("metadata"),
    createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("admin_audit_logs_actor_idx").on(t.actorClerkUserId),
    index("admin_audit_logs_created_at_idx").on(t.createdAt),
  ]
);

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

// ── App tables (Phase 2 — email triage) ───────────────────────────────────────

/**
 * ai_settings
 * Per-organization AI behaviour. One row per org. Created on first AI use,
 * with sensible defaults.
 */
export const aiSettings = pgTable(
  "ai_settings",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    organizationId:   uuid("organization_id").notNull().unique().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    tone:             aiToneEnum("tone").notNull().default("friendly"),
    /** ISO 639-1 code: sv, en, no, da, fi, etc. */
    language:         varchar("language", { length: 10 }).notNull().default("sv"),
    /** Max follow-up questions before escalating */
    maxInteractions:  integer("max_interactions").notNull().default(2),
    /** Optional signature appended to AI replies (Markdown supported) */
    signature:        text("signature"),
    /**
     * Dry-run mode: AI generates and logs drafts but does NOT auto-send.
     * Must be enabled and verified (≥ 20 approved iterations) before
     * autoSendEnabled can be activated.
     * Default false — set manually by Mailmind team via admin console.
     */
    dryRunEnabled:    boolean("dry_run_enabled").notNull().default(false),
    /**
     * Auto-send mode: qualified drafts (confidence ≥ 90%, low risk, etc.)
     * are dispatched automatically without human review.
     * ONLY Mailmind team may activate this. Requires dryRunEnabled to have
     * been verified with ≥ 20 approved dry-run iterations first.
     * Default false.
     */
    autoSendEnabled:  boolean("auto_send_enabled").notNull().default(false),
    createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ai_settings_org_id_idx").on(t.organizationId),
  ]
);

/**
 * case_types
 * User-defined categorisation for incoming requests. AI matches inbound emails
 * to one of these and collects required fields before routing.
 *
 * `slug` is unique within an organisation (not globally).
 */
export const caseTypes = pgTable(
  "case_types",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** lowercase, no spaces — used in AI prompt + routing */
    slug:            varchar("slug", { length: 100 }).notNull(),
    /** Human-readable label shown in UI and email subjects */
    label:           varchar("label", { length: 255 }).notNull(),
    /** Array of field names AI should collect, e.g. ["address","start_date"] */
    requiredFields:  jsonb("required_fields").$type<string[]>().notNull().default([]),
    /** Email address that finished cases of this type are routed to */
    routeToEmail:    varchar("route_to_email", { length: 320 }),
    /** Fallback when AI can't classify (one per org) */
    isDefault:       boolean("is_default").notNull().default(false),
    /** SLA target in hours — inbox shows countdown + red badge when exceeded */
    slaHours:        integer("sla_hours"),
    sortOrder:       integer("sort_order").notNull().default(0),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("case_types_org_slug_idx").on(t.organizationId, t.slug),
    index("case_types_org_idx").on(t.organizationId),
  ]
);

/**
 * inboxes
 * Connected mailboxes (IMAP / Gmail / Outlook). One per email address.
 *
 * `config` is provider-specific JSON:
 *   - imap:   { host, port, username, password_encrypted, tls }
 *   - gmail:  { access_token_encrypted, refresh_token_encrypted, expires_at }
 *   - outlook: same as gmail
 *
 * Tokens MUST be encrypted at rest before insertion. Encryption helper TBD.
 */
export const inboxes = pgTable(
  "inboxes",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    provider:        inboxProviderEnum("provider").notNull(),
    email:           varchar("email", { length: 320 }).notNull(),
    displayName:     varchar("display_name", { length: 255 }),
    status:          inboxStatusEnum("status").notNull().default("connecting"),
    /** Provider-specific connection details (must be encrypted before insert) */
    config:          jsonb("config").$type<Record<string, unknown>>(),
    lastSyncedAt:    timestamp("last_synced_at", { withTimezone: true }),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Globally unique — a single email address can only belong to one inbox
    // across the platform (so the SendGrid webhook can resolve org from `to`).
    uniqueIndex("inboxes_email_idx").on(t.email),
    index("inboxes_org_idx").on(t.organizationId),
  ]
);

/**
 * email_threads
 * One conversation = one thread. Maps to a provider thread (Gmail threadId,
 * IMAP message references, etc.) where possible. inboxId is nullable so
 * threads can be created manually for testing without a connected inbox.
 */
export const emailThreads = pgTable(
  "email_threads",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    organizationId:    uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    inboxId:           uuid("inbox_id").references(() => inboxes.id, {
      onDelete: "cascade",
    }),
    /** Provider thread/conversation id (Gmail threadId, etc.) */
    externalThreadId:  varchar("external_thread_id", { length: 255 }),
    subject:           varchar("subject", { length: 500 }),
    fromEmail:         varchar("from_email", { length: 320 }).notNull(),
    fromName:          varchar("from_name", { length: 255 }),
    status:            threadStatusEnum("status").notNull().default("open"),
    /** Slug from case_types — denormalised for fast filtering */
    caseTypeSlug:      varchar("case_type_slug", { length: 100 }),
    /** Structured data extracted by AI, e.g. { address: "...", start_date: "..." } */
    collectedInfo:     jsonb("collected_info").$type<Record<string, unknown>>().notNull().default({}),
    /** Number of AI responses sent on this thread */
    interactionCount:  integer("interaction_count").notNull().default(0),
    lastMessageAt:     timestamp("last_message_at", { withTimezone: true }),
    /** When snoozed, thread is hidden from inbox until this timestamp */
    snoozedUntil:      timestamp("snoozed_until", { withTimezone: true }),
    /** Free-form agent labels, e.g. ["vip", "follow-up"] */
    tags:              jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_threads_org_status_idx").on(t.organizationId, t.status),
    index("email_threads_org_updated_idx").on(t.organizationId, t.lastMessageAt),
    index("email_threads_external_idx").on(t.externalThreadId),
    index("email_threads_snoozed_idx").on(t.snoozedUntil),
  ]
);

/**
 * email_messages
 * Individual messages in a thread. Append-only — never edited after insert.
 */
export const emailMessages = pgTable(
  "email_messages",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    threadId:           uuid("thread_id").notNull().references(() => emailThreads.id, {
      onDelete: "cascade",
    }),
    role:               messageRoleEnum("role").notNull(),
    /** Provider message id (Gmail messageId / IMAP UID) */
    externalMessageId:  varchar("external_message_id", { length: 255 }),
    bodyText:           text("body_text"),
    bodyHtml:           text("body_html"),
    sentAt:             timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_messages_thread_idx").on(t.threadId, t.sentAt),
    // For SendGrid Inbound idempotency: dedupe webhook retries by external id
    index("email_messages_external_id_idx").on(t.externalMessageId),
  ]
);

/**
 * internal_notes
 * Agent-only commentary attached to a thread. Customers never see these.
 * Useful for handoff between agents, internal context, decisions made offline.
 */
export const internalNotes = pgTable(
  "internal_notes",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    threadId:        uuid("thread_id").notNull().references(() => emailThreads.id, {
      onDelete: "cascade",
    }),
    /** Author of the note. Null when the user has been deleted but the note kept for context. */
    userId:          uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    bodyText:        text("body_text").notNull(),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("internal_notes_thread_idx").on(t.threadId, t.createdAt),
  ]
);

/**
 * reply_templates
 * Saved canned responses agents can quickly insert into a draft. Per-org.
 * Optional `slug` for keyboard shortcuts later (`/quote-thanks` etc.).
 */
export const replyTemplates = pgTable(
  "reply_templates",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    title:           varchar("title", { length: 255 }).notNull(),
    /** Optional shortcut slug for keyboard insertion */
    slug:            varchar("slug", { length: 100 }),
    bodyText:        text("body_text").notNull(),
    /** Counter for analytics on which templates are most used */
    useCount:        integer("use_count").notNull().default(0),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("reply_templates_org_slug_idx").on(t.organizationId, t.slug),
    index("reply_templates_org_idx").on(t.organizationId),
  ]
);

/**
 * ai_drafts
 * AI-generated reply drafts pending human approval. The brief mandates
 * "human approval before replies are sent" — this table is the queue.
 *
 * For status='ask': bodyText is the question to send to customer
 * For status='summarize': bodyText is the confirmation to customer; metadata.summary is the routed summary
 * For status='escalate': bodyText is null; metadata.reason explains why
 */
export const aiDrafts = pgTable(
  "ai_drafts",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    threadId:        uuid("thread_id").notNull().references(() => emailThreads.id, {
      onDelete: "cascade",
    }),
    /** Denormalised for fast org-level queries (e.g. "all pending drafts for org X") */
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** User who triggered generation; null if generated by an automation */
    userId:          uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action:          draftActionEnum("action").notNull(),
    bodyText:        text("body_text"),
    /** Raw AI metadata: { case_type, summary, collected_info, reason, raw } */
    metadata:        jsonb("metadata").$type<Record<string, unknown>>(),
    status:          draftStatusEnum("status").notNull().default("pending"),
    aiModel:         varchar("ai_model", { length: 100 }).notNull(),
    generatedAt:     timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt:      timestamp("approved_at", { withTimezone: true }),
    sentAt:          timestamp("sent_at", { withTimezone: true }),
    /**
     * True when this draft was generated in dry-run mode.
     * The draft is logged for quality review but was NOT (and will NOT be) sent.
     * Counted toward the 20-iteration threshold required before auto-send.
     */
    isDryRun:        boolean("is_dry_run").notNull().default(false),
    /**
     * Dry-run review result set by Mailmind team:
     *   null  = not yet reviewed
     *   true  = quality approved (counts toward threshold)
     *   false = quality rejected (does not count)
     */
    dryRunApproved:  boolean("dry_run_approved"),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_drafts_thread_idx").on(t.threadId, t.generatedAt),
    index("ai_drafts_org_status_idx").on(t.organizationId, t.status),
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

// ── App relations (Phase 2) ──────────────────────────────────────────────────

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const caseTypesRelations = relations(caseTypes, ({ one }) => ({
  organization: one(organizations, {
    fields: [caseTypes.organizationId],
    references: [organizations.id],
  }),
}));

export const inboxesRelations = relations(inboxes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [inboxes.organizationId],
    references: [organizations.id],
  }),
}));
