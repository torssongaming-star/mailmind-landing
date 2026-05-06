/**
 * Thread + message + AI draft repository.
 *
 * All reads/writes scoped to organizationId — the route handlers must never
 * accept a clerkUserId-controlled organizationId from the request body.
 * Resolve org from the authenticated user (via getCurrentAccount), then pass
 * the resolved orgId here.
 */

import { eq, and, desc, asc } from "drizzle-orm";
import {
  db,
  isDbConnected,
  emailThreads,
  emailMessages,
  aiDrafts,
  aiSettings,
  caseTypes,
  type EmailThread,
  type EmailMessage,
  type AiDraft,
  type AiSettings,
  type CaseType,
} from "@/lib/db";

// ── Threads ──────────────────────────────────────────────────────────────────

export async function listThreads(organizationId: string, limit = 50) {
  if (!isDbConnected()) return [] as EmailThread[];
  return db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.organizationId, organizationId))
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

export async function updateThread(
  organizationId: string,
  threadId: string,
  patch: Partial<Pick<EmailThread, "status" | "caseTypeSlug" | "collectedInfo" | "interactionCount" | "lastMessageAt">>
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
