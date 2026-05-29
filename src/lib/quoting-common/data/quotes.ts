/**
 * Quoting-common — quote aggregate data layer.
 *
 * All reads and writes are scoped by `organizationId`.
 * `createQuote` assigns an OFF-YYYY-NNNN number via `nextQuoteNumber` (quote-number.ts).
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  quotingQuotes,
  quotingQuoteLines,
  quotingWorkflowEvents,
} from "@/lib/db/schema";
import type {
  Quote,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteLine,
  UpsertQuoteLineInput,
  WorkflowEvent,
  AppendWorkflowEventInput,
} from "../domain/types";
import { nextQuoteNumber } from "./quote-number";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toQuote(row: typeof quotingQuotes.$inferSelect): Quote {
  return {
    ...row,
    meta: (row.meta as Record<string, unknown>) ?? null,
  } as Quote;
}

function toQuoteLine(row: typeof quotingQuoteLines.$inferSelect): QuoteLine {
  return {
    ...row,
    meta: (row.meta as Record<string, unknown>) ?? null,
  } as QuoteLine;
}

function toWorkflowEvent(row: typeof quotingWorkflowEvents.$inferSelect): WorkflowEvent {
  return row as WorkflowEvent;
}

// ── Quotes ────────────────────────────────────────────────────────────────────

/**
 * List quotes for an org. Optionally filter by vertical and/or status.
 * Returns newest first.
 */
export async function listQuotes(
  orgId: string,
  opts?: { vertical?: string; status?: Quote["status"] },
): Promise<Quote[]> {
  const rows = await db
    .select()
    .from(quotingQuotes)
    .where(
      and(
        eq(quotingQuotes.organizationId, orgId),
        opts?.vertical ? eq(quotingQuotes.vertical, opts.vertical) : undefined,
        opts?.status   ? eq(quotingQuotes.status,   opts.status)   : undefined,
      ),
    )
    .orderBy(desc(quotingQuotes.createdAt));

  return rows.map(toQuote);
}

/**
 * Get a single quote by id. Returns `null` if not found or wrong org.
 */
export async function getQuote(orgId: string, id: string): Promise<Quote | null> {
  const rows = await db
    .select()
    .from(quotingQuotes)
    .where(
      and(
        eq(quotingQuotes.organizationId, orgId),
        eq(quotingQuotes.id, id),
      ),
    )
    .limit(1);

  return rows[0] ? toQuote(rows[0]) : null;
}

/**
 * Create a new quote for an org. Atomically assigns an OFF-YYYY-NNNN number
 * and appends an initial workflow event `{ toStage: 'draft' }`.
 */
export async function createQuote(
  orgId: string,
  input: CreateQuoteInput,
  actorUserId?: string,
): Promise<Quote> {
  const number = await nextQuoteNumber(db, orgId);

  const rows = await db
    .insert(quotingQuotes)
    .values({
      organizationId:     orgId,
      vertical:           input.vertical,
      customerId:         input.customerId          ?? null,
      priceBookVersionId: input.priceBookVersionId  ?? null,
      validUntil:         input.validUntil          ?? null,
      meta:               input.meta               ?? null,
      number,
      status:             "draft",
      currency:           "SEK",
      createdBy:          actorUserId               ?? null,
    })
    .returning();

  const quote = toQuote(rows[0]);

  // Append initial workflow event
  await appendWorkflowEvent(orgId, quote.id, {
    toStage:     "draft",
    actorUserId,
  });

  return quote;
}

/**
 * Update mutable fields on a quote. Status changes are validated by the caller
 * using `canTransition` before calling this function.
 * Returns `null` if not found or wrong org.
 */
export async function updateQuote(
  orgId: string,
  id: string,
  patch: UpdateQuoteInput,
  actorUserId?: string,
): Promise<Quote | null> {
  const existing = await getQuote(orgId, id);
  if (!existing) return null;

  const rows = await db
    .update(quotingQuotes)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quotingQuotes.organizationId, orgId),
        eq(quotingQuotes.id, id),
      ),
    )
    .returning();

  const updated = rows[0] ? toQuote(rows[0]) : null;

  // If status changed, append a workflow event
  if (updated && patch.status && patch.status !== existing.status) {
    await appendWorkflowEvent(orgId, id, {
      fromStage:   existing.status,
      toStage:     patch.status,
      actorUserId,
    });
  }

  return updated;
}

/**
 * Soft-delete a quote by setting its status to `rejected`.
 */
export async function softDeleteQuote(
  orgId: string,
  id: string,
  actorUserId?: string,
): Promise<void> {
  await updateQuote(orgId, id, { status: "rejected" }, actorUserId);
}

// ── Quote lines ───────────────────────────────────────────────────────────────

/**
 * List all lines for a quote, ordered by sortOrder.
 */
export async function listQuoteLines(
  orgId: string,
  quoteId: string,
): Promise<QuoteLine[]> {
  const rows = await db
    .select()
    .from(quotingQuoteLines)
    .where(
      and(
        eq(quotingQuoteLines.organizationId, orgId),
        eq(quotingQuoteLines.quoteId, quoteId),
      ),
    )
    .orderBy(quotingQuoteLines.sortOrder);

  return rows.map(toQuoteLine);
}

/**
 * Replace all lines on a quote with the given set.
 * Deletes existing lines first, then bulk-inserts the new ones.
 * Returns the newly inserted lines.
 */
export async function upsertQuoteLines(
  orgId: string,
  quoteId: string,
  lines: UpsertQuoteLineInput[],
): Promise<QuoteLine[]> {
  // Delete existing
  await db
    .delete(quotingQuoteLines)
    .where(
      and(
        eq(quotingQuoteLines.organizationId, orgId),
        eq(quotingQuoteLines.quoteId, quoteId),
      ),
    );

  if (!lines.length) return [];

  const rows = await db
    .insert(quotingQuoteLines)
    .values(
      lines.map((l, i) => ({
        organizationId: orgId,
        quoteId,
        productId:      l.productId   ?? null,
        description:    l.description,
        qty:            String(l.qty),
        unitPrice:      String(l.unitPrice),
        lineTotal:      String(Math.round(l.qty * l.unitPrice * 100) / 100),
        sortOrder:      l.sortOrder    ?? i,
        meta:           l.meta        ?? null,
      })),
    )
    .returning();

  return rows.map(toQuoteLine);
}

// ── Workflow events ───────────────────────────────────────────────────────────

/**
 * Append a workflow event to the audit trail. Never updates existing events.
 */
export async function appendWorkflowEvent(
  orgId: string,
  quoteId: string,
  input: AppendWorkflowEventInput,
): Promise<void> {
  await db.insert(quotingWorkflowEvents).values({
    organizationId: orgId,
    quoteId,
    fromStage:      input.fromStage   ?? null,
    toStage:        input.toStage,
    actorUserId:    input.actorUserId ?? null,
    reason:         input.reason      ?? null,
  });
}

/**
 * List workflow events for a quote, oldest first (full audit trail).
 */
export async function listWorkflowEvents(
  orgId: string,
  quoteId: string,
): Promise<WorkflowEvent[]> {
  const rows = await db
    .select()
    .from(quotingWorkflowEvents)
    .where(
      and(
        eq(quotingWorkflowEvents.organizationId, orgId),
        eq(quotingWorkflowEvents.quoteId, quoteId),
      ),
    )
    .orderBy(quotingWorkflowEvents.createdAt);

  return rows.map(toWorkflowEvent);
}
