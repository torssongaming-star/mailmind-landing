/**
 * Thread + message + AI draft repository.
 *
 * All reads/writes scoped to organizationId — the route handlers must never
 * accept a clerkUserId-controlled organizationId from the request body.
 * Resolve org from the authenticated user (via getCurrentAccount), then pass
 * the resolved orgId here.
 */

import { eq, and, desc, asc, lte, isNotNull } from "drizzle-orm";
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

// ── Threads ──────────────────────────────────────────────────────────────────

export async function listThreads(
  organizationId: string,
  opts: { limit?: number; showSnoozed?: boolean } = {}
) {
  const { limit = 50, showSnoozed = false } = opts;
  if (!isDbConnected()) return [] as EmailThread[];

  const where = showSnoozed
    ? and(
        eq(emailThreads.organizationId, organizationId),
        isNotNull(emailThreads.snoozedUntil),
      )
    : and(
        eq(emailThreads.organizationId, organizationId),
        // NULL = not snoozed; future date = still snoozed (exclude)
        // We use: snoozedUntil IS NULL OR snoozedUntil <= now()
        // Drizzle doesn't have a clean or() for this, so we run a raw condition
        // via: exclude rows where snoozedUntil > now (i.e. actively snoozed)
        // Done via subfilter below — see note.
      );

  // We need: WHERE org_id = ? AND (snoozed_until IS NULL OR snoozed_until <= now())
  // Drizzle approach: use sql template for the OR condition
  const { sql: sqlTag } = await import("drizzle-orm");
  const activeFilter = sqlTag`(${emailThreads.snoozedUntil} IS NULL OR ${emailThreads.snoozedUntil} <= NOW())`;

  return db
    .select()
    .from(emailThreads)
    .where(
      showSnoozed
        ? and(
            eq(emailThreads.organizationId, organizationId),
            isNotNull(emailThreads.snoozedUntil),
          )
        : and(
            eq(emailThreads.organizationId, organizationId),
            activeFilter,
          )
    )
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
  patch: Partial<Pick<EmailThread, "status" | "caseTypeSlug" | "collectedInfo" | "interactionCount" | "lastMessageAt" | "snoozedUntil">>
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
}) {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(emailMessages)
    .values({
      threadId:           input.threadId,
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

export async function createDraft(input: {
  organizationId: string;
  threadId: string;
  userId?: string | null;
  action: AiDraft["action"];
  bodyText?: string | null;
  metadata?: Record<string, unknown> | null;
  aiModel: string;
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
    createdAt:        new Date(),
    updatedAt:        new Date(),
  };
}
