/**
 * Thread + message + AI draft repository.
 *
 * All reads/writes scoped to organizationId — the route handlers must never
 * accept a clerkUserId-controlled organizationId from the request body.
 * Resolve org from the authenticated user (via getCurrentAccount), then pass
 * the resolved orgId here.
 */

import { eq, and, desc, asc, lte, isNotNull, sql } from "drizzle-orm";
import {
  db,
  isDbConnected,
  emailThreads,
  emailMessages,
  aiDrafts,
  aiSettings,
  caseTypes,
  inboxes,
  type EmailThread,
  type EmailMessage,
  type AiDraft,
  type AiSettings,
  type CaseType,
  type Inbox,
} from "@/lib/db";
import { z } from "zod";

// ── Threads ──────────────────────────────────────────────────────────────────

export async function listThreads(
  organizationId: string,
  opts: { limit?: number; showSnoozed?: boolean; inboxId?: string | null } = {}
) {
  const { limit = 50, showSnoozed = false, inboxId = null } = opts;
  if (!isDbConnected()) return [] as EmailThread[];

  // We need: WHERE org_id = ? AND (snoozed_until IS NULL OR snoozed_until <= now())
  // Drizzle approach: use sql template for the OR condition
  const { sql: sqlTag } = await import("drizzle-orm");
  const activeFilter = sqlTag`(${emailThreads.snoozedUntil} IS NULL OR ${emailThreads.snoozedUntil} <= NOW())`;

  const conditions = [eq(emailThreads.organizationId, organizationId)];
  if (showSnoozed) {
    conditions.push(isNotNull(emailThreads.snoozedUntil));
  } else {
    conditions.push(activeFilter);
  }
  if (inboxId) {
    conditions.push(eq(emailThreads.inboxId, inboxId));
  }

  return db
    .select()
    .from(emailThreads)
    .where(and(...conditions))
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(limit);
}

export async function getThread(organizationId: string, threadId: string) {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(emailThreads)
    .where(and(
      eq(emailThreads.id, threadId),
      eq(emailThreads.organizationId, organizationId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function createThread(input: {
  organizationId: string;
  fromEmail: string;
  fromName?: string | null;
  subject?: string | null;
  inboxId?: string | null;
  externalThreadId?: string | null;
}) {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(emailThreads)
    .values({
      organizationId:    input.organizationId,
      fromEmail:         input.fromEmail,
      fromName:          input.fromName ?? null,
      subject:           input.subject ?? null,
      inboxId:           input.inboxId ?? null,
      externalThreadId:  input.externalThreadId ?? null,
      status:            "open",
      collectedInfo:     {},
      interactionCount:  0,
      lastMessageAt:     new Date(),
    })
    .returning();
  return row ?? null;
}

/** Set externalThreadId on a thread — used after first outbound send so replies thread correctly. */
export async function setThreadExternalId(
  organizationId: string,
  threadId: string,
  externalThreadId: string,
) {
  if (!isDbConnected()) return;
  await db
    .update(emailThreads)
    .set({ externalThreadId, updatedAt: new Date() })
    .where(and(
      eq(emailThreads.id, threadId),
      eq(emailThreads.organizationId, organizationId),
    ));
}

export async function updateThread(
  organizationId: string,
  threadId: string,
  patch: Partial<Pick<EmailThread, "status" | "caseTypeSlug" | "collectedInfo" | "interactionCount" | "lastMessageAt" | "snoozedUntil" | "tags">>
) {
  if (!isDbConnected()) return;
  await db
    .update(emailThreads)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(
      eq(emailThreads.id, threadId),
      eq(emailThreads.organizationId, organizationId),
    ));
}

/**
 * Wake up threads whose snoozedUntil has passed — sets snoozedUntil = NULL.
 * Call this at the start of listThreads so the inbox is always fresh.
 */
export async function wakeUpSnoozedThreads(organizationId: string) {
  if (!isDbConnected()) return;
  await db
    .update(emailThreads)
    .set({ snoozedUntil: null, updatedAt: new Date() })
    .where(and(
      eq(emailThreads.organizationId, organizationId),
      isNotNull(emailThreads.snoozedUntil),
      lte(emailThreads.snoozedUntil, new Date()),
    ));
}

/**
 * Cron entry point — wake snoozed threads across ALL orgs in a single statement.
 * Returns the number of rows affected.
 */
export async function wakeUpAllSnoozedThreads(): Promise<number> {
  if (!isDbConnected()) return 0;
  const result = await db
    .update(emailThreads)
    .set({ snoozedUntil: null, updatedAt: new Date() })
    .where(and(
      isNotNull(emailThreads.snoozedUntil),
      lte(emailThreads.snoozedUntil, new Date()),
    ))
    .returning({ id: emailThreads.id });
  return result.length;
}

/** Count active vs snoozed threads — used by InboxFilters tab counts. */
export async function countSnoozedThreads(organizationId: string): Promise<number> {
  if (!isDbConnected()) return 0;
  const { sql: sqlTag } = await import("drizzle-orm");
    const result = await db.execute(sqlTag`
      SELECT COUNT(*)::int AS n
      FROM email_threads
      WHERE organization_id = ${organizationId}
        AND snoozed_until IS NOT NULL
        AND snoozed_until > NOW()
    `);
    const schema = z.array(z.object({ n: z.number() }));
    const rows = schema.parse(result.rows);
    return rows[0]?.n ?? 0;
}

/** Server-side search across subject, fromEmail, fromName, tags. ILIKE for case-insensitive. */
export async function searchThreads(
  organizationId: string,
  query: string,
  limit = 50,
): Promise<EmailThread[]> {
  if (!isDbConnected()) return [];
  const q = query.trim();
  if (!q) return [];
  const { sql: sqlTag } = await import("drizzle-orm");
  const pattern = `%${q.replace(/[%_]/g, m => "\\" + m)}%`;
    const result = await db.execute(sqlTag`
      SELECT * FROM email_threads
      WHERE organization_id = ${organizationId}
        AND (
          subject     ILIKE ${pattern}
          OR from_email ILIKE ${pattern}
          OR from_name  ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(tags) AS tag
            WHERE tag ILIKE ${pattern}
          )
        )
      ORDER BY last_message_at DESC
      LIMIT ${limit}
    `);
    const schema = z.array(z.unknown()); // Use unknown instead of any to satisfy lint
    return schema.parse(result.rows) as EmailThread[];
}


// ── Messages ─────────────────────────────────────────────────────────────────

export async function listMessages(threadId: string) {
  if (!isDbConnected()) return [] as EmailMessage[];
  return db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(asc(emailMessages.sentAt));
}

export async function appendMessage(input: {
  threadId: string;
  role: EmailMessage["role"];
  bodyText?: string | null;
  bodyHtml?: string | null;
  externalMessageId?: string | null;
  sentAt?: Date;
  /** Optional but recommended — back-fills the org-scope column on email_messages.
   *  When omitted we look it up from the thread. P2.3 defense-in-depth. */
  organizationId?: string;
}) {
  if (!isDbConnected()) return null;

  // Resolve orgId from thread if not provided — backward compat for callers
  // that don't have it handy.
  let organizationId = input.organizationId;
  if (!organizationId) {
    const t = await db
      .select({ organizationId: emailThreads.organizationId })
      .from(emailThreads)
      .where(eq(emailThreads.id, input.threadId))
      .limit(1)
      .then(r => r[0]);
    organizationId = t?.organizationId;
  }

  const [row] = await db
    .insert(emailMessages)
    .values({
      threadId:           input.threadId,
      organizationId:     organizationId ?? null,
      role:               input.role,
      bodyText:           input.bodyText ?? null,
      bodyHtml:           input.bodyHtml ?? null,
      externalMessageId:  input.externalMessageId ?? null,
      sentAt:             input.sentAt ?? new Date(),
    })
    .returning();
  return row ?? null;
}

// ── AI drafts ────────────────────────────────────────────────────────────────

export async function listDraftsForThread(threadId: string) {
  if (!isDbConnected()) return [] as AiDraft[];
  return db
    .select()
    .from(aiDrafts)
    .where(eq(aiDrafts.threadId, threadId))
    .orderBy(desc(aiDrafts.generatedAt));
}

/** Returns the newest pending/edited draft for a thread, or null if none. */
export async function findPendingDraft(threadId: string): Promise<AiDraft | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(aiDrafts)
    .where(
      and(
        eq(aiDrafts.threadId, threadId),
        sql`${aiDrafts.status} IN ('pending', 'edited')`,
        eq(aiDrafts.isDryRun, false),
      )
    )
    .orderBy(desc(aiDrafts.generatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createDraft(input: {
  organizationId: string;
  threadId: string;
  userId?: string | null;
  action: AiDraft["action"];
  bodyText?: string | null;
  metadata?: Record<string, unknown> | null;
  aiModel: string;
  isDryRun?: boolean;
}) {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(aiDrafts)
    .values({
      organizationId: input.organizationId,
      threadId:       input.threadId,
      userId:         input.userId ?? null,
      action:         input.action,
      bodyText:       input.bodyText ?? null,
      metadata:       input.metadata ?? null,
      aiModel:        input.aiModel,
      status:         "pending",
      generatedAt:    new Date(),
      isDryRun:       input.isDryRun ?? false,
    })
    .returning();
  return row ?? null;
}

export async function getDraft(organizationId: string, draftId: string) {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(aiDrafts)
    .where(and(
      eq(aiDrafts.id, draftId),
      eq(aiDrafts.organizationId, organizationId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateDraft(
  organizationId: string,
  draftId: string,
  patch: Partial<Pick<AiDraft, "status" | "bodyText" | "approvedAt" | "sentAt">>
) {
  if (!isDbConnected()) return;
  await db
    .update(aiDrafts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(
      eq(aiDrafts.id, draftId),
      eq(aiDrafts.organizationId, organizationId),
    ));
}

// ── AI settings + case types (per org) ───────────────────────────────────────

/**
 * Get the org's AI settings. Returns null if not yet initialised — callers
 * can fall back to defaults until the user customises them.
 */
export async function getAiSettings(organizationId: string): Promise<AiSettings | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, organizationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listCaseTypes(organizationId: string): Promise<CaseType[]> {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(caseTypes)
    .where(eq(caseTypes.organizationId, organizationId))
    .orderBy(asc(caseTypes.sortOrder), asc(caseTypes.label));
}

// ── Inboxes ──────────────────────────────────────────────────────────────────

export async function listInboxes(organizationId: string): Promise<Inbox[]> {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(inboxes)
    .where(eq(inboxes.organizationId, organizationId))
    .orderBy(asc(inboxes.createdAt));
}

export async function getInboxByEmail(email: string): Promise<Inbox | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(inboxes)
    .where(eq(inboxes.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/** Throws on DB error so callers can surface the actual reason. */
export async function createMailmindInbox(input: {
  organizationId: string;
  slug: string;
  displayName: string;
  forwardedFrom?: string | null;
}): Promise<Inbox | null> {
  if (!isDbConnected()) return null;
  const email = `${input.slug}@mail.mailmind.se`.toLowerCase();
  const rows = await db
    .insert(inboxes)
    .values({
      organizationId: input.organizationId,
      provider:       "mailmind",
      email,
      displayName:    input.displayName,
      status:         "active",
      config:         { forwardedFrom: input.forwardedFrom ?? null },
    })
    .returning();
  return rows[0] ?? null;
}

/** Update the config jsonb on an inbox row (e.g. to persist refreshed tokens or historyId). */
export async function updateInboxConfig(inboxId: string, config: Record<string, unknown>) {
  if (!isDbConnected()) return;
  await db
    .update(inboxes)
    .set({ config, updatedAt: new Date() })
    .where(eq(inboxes.id, inboxId));
}

/** Create a Gmail OAuth inbox. config stores encrypted tokens. */
export async function createGmailInbox(input: {
  organizationId: string;
  email:          string;
  displayName:    string;
  config:         Record<string, unknown>;
}): Promise<Inbox | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .insert(inboxes)
    .values({
      organizationId: input.organizationId,
      provider:       "gmail",
      email:          input.email.toLowerCase(),
      displayName:    input.displayName,
      status:         "active",
      config:         input.config,
    })
    .returning();
  return rows[0] ?? null;
}

export async function createOutlookInbox(input: {
  organizationId: string;
  email:          string;
  displayName:    string;
  config:         Record<string, unknown>;
}): Promise<Inbox | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .insert(inboxes)
    .values({
      organizationId: input.organizationId,
      provider:       "outlook",
      email:          input.email.toLowerCase(),
      displayName:    input.displayName,
      status:         "active",
      config:         input.config,
    })
    .returning();
  return rows[0] ?? null;
}

/** Look up an inbox by its Microsoft Graph subscriptionId (stored in config jsonb). */
export async function getInboxBySubscriptionId(subscriptionId: string): Promise<Inbox | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(inboxes)
    .where(
      and(
        eq(inboxes.provider, "outlook"),
        // JSONB containment: config @> '{"subscriptionId": "<id>"}'
        sql`${inboxes.config} @> ${JSON.stringify({ subscriptionId })}::jsonb`,
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteInbox(organizationId: string, inboxId: string) {
  if (!isDbConnected()) return;
  await db
    .delete(inboxes)
    .where(and(
      eq(inboxes.id, inboxId),
      eq(inboxes.organizationId, organizationId),
    ));
}

/** All threads from the same sender email, excluding the current thread. */
export async function listThreadsByEmail(
  organizationId: string,
  fromEmail: string,
  excludeThreadId: string,
  limit = 10,
): Promise<EmailThread[]> {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(emailThreads)
    .where(and(
      eq(emailThreads.organizationId, organizationId),
      eq(emailThreads.fromEmail, fromEmail.toLowerCase()),
      // exclude current thread — using sql tag for != since drizzle uses ne()
    ))
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(limit + 1) // fetch one extra so we can filter the current thread client-side
    .then(rows => rows.filter(r => r.id !== excludeThreadId).slice(0, limit));
}

/**
 * Customer history summary — compact view of past interactions with the same
 * email address. Used to inject context into the AI prompt so it knows whether
 * the sender is a returning customer with prior issues.
 *
 * Performance: capped to 5 most-recent past threads, ordered by lastMessageAt.
 * Keeps the prompt budget tight while still useful.
 */
export type CustomerHistorySummary = {
  pastThreadCount: number;
  threads: Array<{
    subject:      string | null;
    caseTypeSlug: string | null;
    status:       string;
    lastMessageAt: Date | null;
  }>;
};

export async function getCustomerHistory(
  organizationId: string,
  fromEmail: string,
  excludeThreadId: string,
  maxThreads = 5,
): Promise<CustomerHistorySummary> {
  if (!isDbConnected()) return { pastThreadCount: 0, threads: [] };

  const rows = await db
    .select({
      id:            emailThreads.id,
      subject:       emailThreads.subject,
      caseTypeSlug:  emailThreads.caseTypeSlug,
      status:        emailThreads.status,
      lastMessageAt: emailThreads.lastMessageAt,
    })
    .from(emailThreads)
    .where(and(
      eq(emailThreads.organizationId, organizationId),
      eq(emailThreads.fromEmail, fromEmail.toLowerCase()),
    ))
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(maxThreads + 5); // fetch a few extra so we can filter current + cap

  const filtered = rows.filter(r => r.id !== excludeThreadId);
  return {
    pastThreadCount: filtered.length,
    threads: filtered.slice(0, maxThreads).map(r => ({
      subject:       r.subject,
      caseTypeSlug:  r.caseTypeSlug,
      status:        r.status,
      lastMessageAt: r.lastMessageAt,
    })),
  };
}

/** Find an already-stored message by its external id (for webhook idempotency). */
export async function findMessageByExternalId(externalMessageId: string): Promise<EmailMessage | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.externalMessageId, externalMessageId))
    .limit(1);
  return rows[0] ?? null;
}

/** Find existing thread by external thread id within an org */
export async function findThreadByExternalId(
  organizationId: string,
  externalThreadId: string
): Promise<EmailThread | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(emailThreads)
    .where(and(
      eq(emailThreads.organizationId, organizationId),
      eq(emailThreads.externalThreadId, externalThreadId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/** Sane defaults when an org hasn't customised settings yet. */
export function defaultAiSettings(organizationId: string): AiSettings {
  return {
    id:               "00000000-0000-0000-0000-000000000000",
    organizationId,
    tone:             "friendly",
    language:         "sv",
    maxInteractions:  2,
    signature:        null,
    dryRunEnabled:    false,
    autoSendEnabled:  false,
    createdAt:        new Date(),
    updatedAt:        new Date(),
  };
}
