/**
 * Quoting-common — knowledge base data layer.
 *
 * All reads and writes are scoped by `organizationId` (Mailmind multi-tenant
 * invariant). No function here operates without an org predicate.
 *
 * Audience classification is enforced structurally:
 *   • `listCustomerFacingEntries` only returns `visibility = 'customer_facing'`
 *   • All other queries return both audiences (internal use by the engine)
 *
 * See schema.quoting.ts §13.4 for rationale.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotingKbEntries } from "@/lib/db/schema";
import type {
  KbEntry,
  CreateKbEntryInput,
  UpdateKbEntryInput,
} from "../domain/types";

// ── Helper ────────────────────────────────────────────────────────────────────

function toKbEntry(row: typeof quotingKbEntries.$inferSelect): KbEntry {
  return {
    id:             row.id,
    organizationId: row.organizationId,
    title:          row.title,
    body:           row.body,
    category:       row.category,
    visibility:     row.visibility,
    vertical:       row.vertical ?? null,
    source:         row.source ?? null,
    createdBy:      row.createdBy ?? null,
    createdAt:      row.createdAt,
    updatedAt:      row.updatedAt,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All KB entries for the org (internal + customer-facing), newest first. */
export async function listKbEntries(orgId: string): Promise<KbEntry[]> {
  const rows = await db
    .select()
    .from(quotingKbEntries)
    .where(eq(quotingKbEntries.organizationId, orgId))
    .orderBy(desc(quotingKbEntries.createdAt));
  return rows.map(toKbEntry);
}

/**
 * Only customer-facing entries — safe for outbound quote/PDF/email copy.
 * Optionally filtered by vertical (pass null or omit for universal entries).
 */
export async function listCustomerFacingEntries(
  orgId:     string,
  vertical?: string,
): Promise<KbEntry[]> {
  const conditions = [
    eq(quotingKbEntries.organizationId, orgId),
    eq(quotingKbEntries.visibility, "customer_facing"),
  ];
  if (vertical !== undefined) {
    conditions.push(eq(quotingKbEntries.vertical, vertical));
  }

  const rows = await db
    .select()
    .from(quotingKbEntries)
    .where(and(...conditions))
    .orderBy(desc(quotingKbEntries.createdAt));
  return rows.map(toKbEntry);
}

/** Single entry by ID, org-scoped. Returns null if not found or wrong org. */
export async function getKbEntry(
  orgId: string,
  id:    string,
): Promise<KbEntry | null> {
  const rows = await db
    .select()
    .from(quotingKbEntries)
    .where(
      and(
        eq(quotingKbEntries.organizationId, orgId),
        eq(quotingKbEntries.id, id),
      ),
    )
    .limit(1);
  return rows[0] ? toKbEntry(rows[0]) : null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Create a new KB entry. Visibility defaults to `internal_only` (fail-safe). */
export async function createKbEntry(
  orgId: string,
  input: CreateKbEntryInput,
): Promise<KbEntry> {
  const rows = await db
    .insert(quotingKbEntries)
    .values({
      organizationId: orgId,
      title:          input.title,
      body:           input.body,
      category:       input.category   ?? "other",
      visibility:     input.visibility ?? "internal_only",
      vertical:       input.vertical   ?? null,
      source:         input.source     ?? null,
      createdBy:      input.createdBy  ?? null,
    })
    .returning();
  return toKbEntry(rows[0]);
}

/** Partial update — visibility must be set explicitly to promote an entry. */
export async function updateKbEntry(
  orgId: string,
  id:    string,
  patch: UpdateKbEntryInput,
): Promise<KbEntry | null> {
  const rows = await db
    .update(quotingKbEntries)
    .set({
      ...(patch.title      !== undefined && { title:      patch.title }),
      ...(patch.body       !== undefined && { body:       patch.body }),
      ...(patch.category   !== undefined && { category:   patch.category }),
      ...(patch.visibility !== undefined && { visibility: patch.visibility }),
      ...(patch.vertical   !== undefined && { vertical:   patch.vertical }),
      ...(patch.source     !== undefined && { source:     patch.source }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quotingKbEntries.organizationId, orgId),
        eq(quotingKbEntries.id, id),
      ),
    )
    .returning();
  return rows[0] ? toKbEntry(rows[0]) : null;
}

/** Hard delete a KB entry. */
export async function deleteKbEntry(
  orgId: string,
  id:    string,
): Promise<boolean> {
  const rows = await db
    .delete(quotingKbEntries)
    .where(
      and(
        eq(quotingKbEntries.organizationId, orgId),
        eq(quotingKbEntries.id, id),
      ),
    )
    .returning({ id: quotingKbEntries.id });
  return rows.length > 0;
}
