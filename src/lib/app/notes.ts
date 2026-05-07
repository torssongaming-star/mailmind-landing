/**
 * Internal notes + reply templates — server-side helpers.
 *
 * All queries org-scoped via thread.organizationId join (notes) or directly
 * (templates).
 */

import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import {
  db,
  isDbConnected,
  internalNotes,
  replyTemplates,
  emailThreads,
  users,
  type InternalNote,
  type ReplyTemplate,
} from "@/lib/db";

// ── Internal notes ───────────────────────────────────────────────────────────

export type NoteWithAuthor = InternalNote & {
  authorEmail: string | null;
};

export async function listNotes(
  organizationId: string,
  threadId: string
): Promise<NoteWithAuthor[]> {
  if (!isDbConnected()) return [];
  // Join through threads to verify the thread belongs to the org. Cheaper than
  // a separate ownership check + same query.
  const rows = await db
    .select({
      id:             internalNotes.id,
      threadId:       internalNotes.threadId,
      userId:         internalNotes.userId,
      bodyText:       internalNotes.bodyText,
      createdAt:      internalNotes.createdAt,
      updatedAt:      internalNotes.updatedAt,
      authorEmail:    users.email,
    })
    .from(internalNotes)
    .innerJoin(emailThreads, eq(emailThreads.id, internalNotes.threadId))
    .leftJoin(users, eq(users.id, internalNotes.userId))
    .where(and(
      eq(internalNotes.threadId, threadId),
      eq(emailThreads.organizationId, organizationId),
    ))
    .orderBy(asc(internalNotes.createdAt));
  return rows;
}

export async function createNote(input: {
  organizationId: string;
  threadId: string;
  userId: string;
  bodyText: string;
}): Promise<InternalNote | null> {
  if (!isDbConnected()) return null;

  // Verify thread belongs to org before creating
  const thread = await db
    .select({ id: emailThreads.id })
    .from(emailThreads)
    .where(and(
      eq(emailThreads.id, input.threadId),
      eq(emailThreads.organizationId, input.organizationId),
    ))
    .limit(1);
  if (thread.length === 0) return null;

  const [row] = await db
    .insert(internalNotes)
    .values({
      threadId: input.threadId,
      userId:   input.userId,
      bodyText: input.bodyText,
    })
    .returning();
  return row ?? null;
}

export async function deleteNote(input: {
  organizationId: string;
  noteId: string;
}): Promise<boolean> {
  if (!isDbConnected()) return false;
  // Org-scoped via subquery: thread must belong to the user's org
  const orgThreadIds = db
    .select({ id: emailThreads.id })
    .from(emailThreads)
    .where(eq(emailThreads.organizationId, input.organizationId));

  const result = await db
    .delete(internalNotes)
    .where(and(
      eq(internalNotes.id, input.noteId),
      inArray(internalNotes.threadId, orgThreadIds),
    ))
    .returning({ id: internalNotes.id });
  return result.length > 0;
}

// ── Reply templates ──────────────────────────────────────────────────────────

export async function listTemplates(organizationId: string): Promise<ReplyTemplate[]> {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(replyTemplates)
    .where(eq(replyTemplates.organizationId, organizationId))
    .orderBy(desc(replyTemplates.useCount), asc(replyTemplates.title));
}

export async function getTemplate(
  organizationId: string,
  templateId: string
): Promise<ReplyTemplate | null> {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(replyTemplates)
    .where(and(
      eq(replyTemplates.id, templateId),
      eq(replyTemplates.organizationId, organizationId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTemplate(input: {
  organizationId: string;
  title: string;
  slug?: string | null;
  bodyText: string;
}): Promise<ReplyTemplate | null> {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(replyTemplates)
    .values({
      organizationId: input.organizationId,
      title:          input.title,
      slug:           input.slug ?? null,
      bodyText:       input.bodyText,
    })
    .returning();
  return row ?? null;
}

export async function updateTemplate(input: {
  organizationId: string;
  templateId: string;
  patch: Partial<Pick<ReplyTemplate, "title" | "slug" | "bodyText">>;
}): Promise<void> {
  if (!isDbConnected()) return;
  await db
    .update(replyTemplates)
    .set({ ...input.patch, updatedAt: new Date() })
    .where(and(
      eq(replyTemplates.id, input.templateId),
      eq(replyTemplates.organizationId, input.organizationId),
    ));
}

export async function deleteTemplate(input: {
  organizationId: string;
  templateId: string;
}): Promise<void> {
  if (!isDbConnected()) return;
  await db
    .delete(replyTemplates)
    .where(and(
      eq(replyTemplates.id, input.templateId),
      eq(replyTemplates.organizationId, input.organizationId),
    ));
}

/** Increment useCount when a template is inserted into a draft. Best-effort. */
export async function incrementTemplateUseCount(
  organizationId: string,
  templateId: string
): Promise<void> {
  if (!isDbConnected()) return;
  await db
    .update(replyTemplates)
    .set({
      useCount:  sql`${replyTemplates.useCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(replyTemplates.id, templateId),
      eq(replyTemplates.organizationId, organizationId),
    ));
}
