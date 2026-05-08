/**
 * Knowledge base repository — per-org FAQ entries injected into AI prompts.
 */

import { eq, and, asc } from "drizzle-orm";
import { db, isDbConnected, knowledgeEntries, type KnowledgeEntry } from "@/lib/db";

export async function listKnowledge(organizationId: string): Promise<KnowledgeEntry[]> {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.organizationId, organizationId))
    .orderBy(asc(knowledgeEntries.sortOrder), asc(knowledgeEntries.createdAt));
}

export async function listActiveKnowledge(organizationId: string): Promise<KnowledgeEntry[]> {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(knowledgeEntries)
    .where(and(
      eq(knowledgeEntries.organizationId, organizationId),
      eq(knowledgeEntries.isActive, true),
    ))
    .orderBy(asc(knowledgeEntries.sortOrder), asc(knowledgeEntries.createdAt));
}

export async function createKnowledgeEntry(input: {
  organizationId: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder?: number;
}): Promise<KnowledgeEntry | null> {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(knowledgeEntries)
    .values({
      organizationId: input.organizationId,
      question:       input.question.trim(),
      answer:         input.answer.trim(),
      category:       input.category ?? null,
      isActive:       true,
      sortOrder:      input.sortOrder ?? 0,
    })
    .returning();
  return row ?? null;
}

export async function updateKnowledgeEntry(
  organizationId: string,
  entryId: string,
  patch: Partial<Pick<KnowledgeEntry, "question" | "answer" | "category" | "isActive" | "sortOrder">>
): Promise<void> {
  if (!isDbConnected()) return;
  await db
    .update(knowledgeEntries)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(
      eq(knowledgeEntries.id, entryId),
      eq(knowledgeEntries.organizationId, organizationId),
    ));
}

export async function deleteKnowledgeEntry(
  organizationId: string,
  entryId: string,
): Promise<void> {
  if (!isDbConnected()) return;
  await db
    .delete(knowledgeEntries)
    .where(and(
      eq(knowledgeEntries.id, entryId),
      eq(knowledgeEntries.organizationId, organizationId),
    ));
}

/** Bulk-insert entries (used during onboarding website scrape). */
export async function bulkCreateKnowledge(
  organizationId: string,
  entries: { question: string; answer: string; category?: string }[],
): Promise<number> {
  if (!isDbConnected() || entries.length === 0) return 0;
  const rows = entries.map((e, i) => ({
    organizationId,
    question:  e.question.trim(),
    answer:    e.answer.trim(),
    category:  e.category ?? null,
    isActive:  true,
    sortOrder: i,
  }));
  const inserted = await db.insert(knowledgeEntries).values(rows).returning();
  return inserted.length;
}
