/**
 * Drizzle ORM schema for Mailmind customer portal.
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

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "member"]);
export const planEnum = pgEnum("plan", ["starter", "team", "business"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "incomplete",
  "paused",
]);
export const aiToneEnum = pgEnum("ai_tone", ["formal", "friendly", "neutral"]);
export const inboxProviderEnum = pgEnum("inbox_provider", ["mailmind", "imap", "gmail", "outlook"]);
export const inboxStatusEnum = pgEnum("inbox_status", ["connecting", "active", "error", "paused"]);
export const threadStatusEnum = pgEnum("thread_status", ["open", "waiting", "escalated", "resolved"]);
export const messageRoleEnum = pgEnum("message_role", ["customer", "assistant", "agent"]);
export const draftActionEnum = pgEnum("draft_action", ["ask", "summarize", "escalate"]);
export const draftStatusEnum = pgEnum("draft_status", [
  "pending",
  "approved",
  "edited",
  "sent",
  "rejected",
]);
export const adminCustomerStatusEnum = pgEnum("admin_customer_status", [
  "internal_test",
  "pilot",
  "active_customer",
  "enterprise_lead",
  "enterprise_customer",
  "churned",
]);
export const adminKnowledgeStatusEnum = pgEnum("admin_knowledge_status", ["draft", "published", "archived"]);
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
export const adminNoteSubjectTypeEnum = pgEnum("admin_note_subject_type", [
  "user",
  "organization",
  "enterprise",
  "general",
]);

// ── Admin Tables ──────────────────────────────────────────────────────────────

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

// ── Core Tables ───────────────────────────────────────────────────────────────

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

export const users = pgTable(
  "users",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    clerkUserId:    varchar("clerk_user_id", { length: 255 }).notNull().unique(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
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

export const subscriptions = pgTable(
  "subscriptions",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    organizationId:       uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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

export const licenseEntitlements = pgTable(
  "license_entitlements",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    organizationId:      uuid("organization_id").notNull().unique().references(() => organizations.id, { onDelete: "cascade" }),
    plan:                planEnum("plan").notNull(),
    maxUsers:            integer("max_users").notNull().default(2),
    maxInboxes:          integer("max_inboxes").notNull().default(1),
    maxAiDraftsPerMonth: integer("max_ai_drafts_per_month").notNull().default(500),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("license_entitlements_org_id_idx").on(t.organizationId)]
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    organizationId:   uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    month:            date("month").notNull(),
    aiDraftsUsed:     integer("ai_drafts_used").notNull().default(0),
    emailsProcessed:  integer("emails_processed").notNull().default(0),
    createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("usage_counters_org_month_idx").on(t.organizationId, t.month)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId:         uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action:         varchar("action", { length: 100 }).notNull(),
    metadata:       jsonb("metadata"),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_org_id_idx").on(t.organizationId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ]
);

// ── App Tables ────────────────────────────────────────────────────────────────

export const aiSettings = pgTable(
  "ai_settings",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    organizationId:   uuid("organization_id").notNull().unique().references(() => organizations.id, { onDelete: "cascade" }),
    tone:             aiToneEnum("tone").notNull().default("friendly"),
    language:         varchar("language", { length: 10 }).notNull().default("sv"),
    maxInteractions:  integer("max_interactions").notNull().default(2),
    signature:        text("signature"),
    dryRunEnabled:    boolean("dry_run_enabled").notNull().default(false),
    autoSendEnabled:  boolean("auto_send_enabled").notNull().default(false),
    createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ai_settings_org_id_idx").on(t.organizationId)]
);

export const caseTypes = pgTable(
  "case_types",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    slug:            varchar("slug", { length: 100 }).notNull(),
    label:           varchar("label", { length: 255 }).notNull(),
    requiredFields:  jsonb("required_fields").$type<string[]>().notNull().default([]),
    routeToEmail:    varchar("route_to_email", { length: 320 }),
    isDefault:       boolean("is_default").notNull().default(false),
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

export const inboxes = pgTable(
  "inboxes",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    provider:        inboxProviderEnum("provider").notNull(),
    email:           varchar("email", { length: 320 }).notNull(),
    displayName:     varchar("display_name", { length: 255 }),
    status:          inboxStatusEnum("status").notNull().default("connecting"),
    config:          jsonb("config").$type<Record<string, unknown>>(),
    lastSyncedAt:    timestamp("last_synced_at", { withTimezone: true }),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("inboxes_email_idx").on(t.email),
    index("inboxes_org_idx").on(t.organizationId),
  ]
);

export const emailThreads = pgTable(
  "email_threads",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    organizationId:    uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    inboxId:           uuid("inbox_id").references(() => inboxes.id, { onDelete: "cascade" }),
    externalThreadId:  varchar("external_thread_id", { length: 255 }),
    subject:           varchar("subject", { length: 500 }),
    fromEmail:         varchar("from_email", { length: 320 }).notNull(),
    fromName:          varchar("from_name", { length: 255 }),
    status:            threadStatusEnum("status").notNull().default("open"),
    caseTypeSlug:      varchar("case_type_slug", { length: 100 }),
    collectedInfo:     jsonb("collected_info").$type<Record<string, unknown>>().notNull().default({}),
    interactionCount:  integer("interaction_count").notNull().default(0),
    lastMessageAt:     timestamp("last_message_at", { withTimezone: true }),
    snoozedUntil:      timestamp("snoozed_until", { withTimezone: true }),
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

export const emailMessages = pgTable(
  "email_messages",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    threadId:           uuid("thread_id").notNull().references(() => emailThreads.id, { onDelete: "cascade" }),
    role:               messageRoleEnum("role").notNull(),
    externalMessageId:  varchar("external_message_id", { length: 255 }),
    bodyText:           text("body_text"),
    bodyHtml:           text("body_html"),
    sentAt:             timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_messages_thread_idx").on(t.threadId, t.sentAt),
    uniqueIndex("email_messages_external_id_uniq").on(t.externalMessageId),
  ]
);

export const internalNotes = pgTable(
  "internal_notes",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    threadId:        uuid("thread_id").notNull().references(() => emailThreads.id, { onDelete: "cascade" }),
    userId:          uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    bodyText:        text("body_text").notNull(),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("internal_notes_thread_idx").on(t.threadId, t.createdAt)]
);

export const replyTemplates = pgTable(
  "reply_templates",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    title:           varchar("title", { length: 255 }).notNull(),
    slug:            varchar("slug", { length: 100 }),
    bodyText:        text("body_text").notNull(),
    useCount:        integer("use_count").notNull().default(0),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("reply_templates_org_slug_idx").on(t.organizationId, t.slug),
    index("reply_templates_org_idx").on(t.organizationId),
  ]
);

export const aiDrafts = pgTable(
  "ai_drafts",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    threadId:        uuid("thread_id").notNull().references(() => emailThreads.id, { onDelete: "cascade" }),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId:          uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action:          draftActionEnum("action").notNull(),
    bodyText:        text("body_text"),
    metadata:        jsonb("metadata").$type<Record<string, unknown>>(),
    status:          draftStatusEnum("status").notNull().default("pending"),
    aiModel:         varchar("ai_model", { length: 100 }).notNull(),
    generatedAt:     timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt:      timestamp("approved_at", { withTimezone: true }),
    sentAt:          timestamp("sent_at", { withTimezone: true }),
    isDryRun:        boolean("is_dry_run").notNull().default(false),
    dryRunApproved:  boolean("dry_run_approved"),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_drafts_thread_idx").on(t.threadId, t.generatedAt),
    index("ai_drafts_org_status_idx").on(t.organizationId, t.status),
  ]
);

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    question:       text("question").notNull(),
    answer:         text("answer").notNull(),
    category:       varchar("category", { length: 100 }),
    isActive:       boolean("is_active").notNull().default(true),
    sortOrder:      integer("sort_order").notNull().default(0),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("knowledge_entries_org_idx").on(t.organizationId),
    index("knowledge_entries_org_active_idx").on(t.organizationId, t.isActive),
  ]
);

export const senderBlocklist = pgTable(
  "sender_blocklist",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    pattern:        varchar("pattern", { length: 320 }).notNull(),
    reason:         varchar("reason", { length: 500 }),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("sender_blocklist_org_idx").on(t.organizationId),
    uniqueIndex("sender_blocklist_org_pattern_idx").on(t.organizationId, t.pattern),
  ]
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    organizationId:  uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    url:             varchar("url", { length: 2048 }).notNull(),
    caseTypeSlug:    varchar("case_type_slug", { length: 100 }).notNull().default("*"),
    secret:          varchar("secret", { length: 255 }),
    isActive:        boolean("is_active").notNull().default(true),
    lastStatus:      varchar("last_status", { length: 20 }),
    lastFiredAt:     timestamp("last_fired_at", { withTimezone: true }),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("webhook_endpoints_org_idx").on(t.organizationId)]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    endpointId:     uuid("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    threadId:       uuid("thread_id"),
    statusCode:     integer("status_code"),
    durationMs:     integer("duration_ms"),
    error:          text("error"),
    sentAt:         timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("webhook_deliveries_endpoint_idx").on(t.endpointId, t.sentAt),
    index("webhook_deliveries_org_idx").on(t.organizationId, t.sentAt),
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
  // aiSettings is a one-to-one keyed on organizationId. Declared on both sides
  // so `db.query.organizations.findFirst({ with: { aiSettings: true } })` works.
  aiSettings: one(aiSettings, {
    fields:     [organizations.id],
    references: [aiSettings.organizationId],
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
  threads: many(emailThreads),
}));

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [emailThreads.organizationId],
    references: [organizations.id],
  }),
  inbox: one(inboxes, {
    fields: [emailThreads.inboxId],
    references: [inboxes.id],
  }),
  messages: many(emailMessages),
  drafts:   many(aiDrafts),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  thread: one(emailThreads, {
    fields: [emailMessages.threadId],
    references: [emailThreads.id],
  }),
}));

export const internalNotesRelations = relations(internalNotes, ({ one }) => ({
  thread: one(emailThreads, {
    fields: [internalNotes.threadId],
    references: [emailThreads.id],
  }),
  user: one(users, {
    fields: [internalNotes.userId],
    references: [users.id],
  }),
}));

export const replyTemplatesRelations = relations(replyTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [replyTemplates.organizationId],
    references: [organizations.id],
  }),
}));

export const aiDraftsRelations = relations(aiDrafts, ({ one }) => ({
  thread: one(emailThreads, {
    fields: [aiDrafts.threadId],
    references: [emailThreads.id],
  }),
  organization: one(organizations, {
    fields: [aiDrafts.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [aiDrafts.userId],
    references: [users.id],
  }),
}));

// ── Inferred Types ────────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type LicenseEntitlement = typeof licenseEntitlements.$inferSelect;
export type NewLicenseEntitlement = typeof licenseEntitlements.$inferInsert;
export type UsageCounter = typeof usageCounters.$inferSelect;
export type NewUsageCounter = typeof usageCounters.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type AiSettings = typeof aiSettings.$inferSelect;
export type NewAiSettings = typeof aiSettings.$inferInsert;
export type CaseType = typeof caseTypes.$inferSelect;
export type NewCaseType = typeof caseTypes.$inferInsert;
export type Inbox = typeof inboxes.$inferSelect;
export type NewInbox = typeof inboxes.$inferInsert;
export type EmailThread = typeof emailThreads.$inferSelect;
export type NewEmailThread = typeof emailThreads.$inferInsert;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type NewEmailMessage = typeof emailMessages.$inferInsert;
export type AiDraft = typeof aiDrafts.$inferSelect;
export type NewAiDraft = typeof aiDrafts.$inferInsert;
export type InternalNote = typeof internalNotes.$inferSelect;
export type NewInternalNote = typeof internalNotes.$inferInsert;
export type ReplyTemplate = typeof replyTemplates.$inferSelect;
export type NewReplyTemplate = typeof replyTemplates.$inferInsert;
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;
export type SenderBlock = typeof senderBlocklist.$inferSelect;
export type NewSenderBlock = typeof senderBlocklist.$inferInsert;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

export type AdminCustomerProfile = typeof adminCustomerProfiles.$inferSelect;
export type NewAdminCustomerProfile = typeof adminCustomerProfiles.$inferInsert;
export type AdminNote = typeof adminNotes.$inferSelect;
export type NewAdminNote = typeof adminNotes.$inferInsert;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
export type AdminKnowledgeArticle = typeof adminKnowledgeArticles.$inferSelect;
export type NewAdminKnowledgeArticle = typeof adminKnowledgeArticles.$inferInsert;
