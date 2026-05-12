/**
 * App usage tracking — server-side only.
 *
 * Wraps queries.incrementAiDrafts with an entitlement guard so callers can't
 * accidentally overshoot the monthly limit. Returns the new counter value so
 * UI can update without an extra round-trip.
 *
 * Race conditions:
 *   The DB UPSERT (insert + onConflictDoUpdate) on the unique
 *   (organization_id, month) index is atomic at the row level. Two concurrent
 *   AI draft generations may both pass the limit check (TOCTOU) and increment
 *   one over the limit; that's acceptable for now. Hard cap is enforced by
 *   billing — Stripe never charges based on these counters directly.
 */

import { eq, and, sql } from "drizzle-orm";
import { db, isDbConnected, usageCounters } from "@/lib/db";
import { getCurrentAccount } from "./entitlements";
import { writeAuditLog } from "./audit";

/** First day of the current calendar month, ISO YYYY-MM-01. */
function currentMonthIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

// ── AI draft counter ──────────────────────────────────────────────────────────

export type IncrementResult =
  | { ok: true; aiDraftsUsed: number; limit: number }
  | { ok: false; reason: "limit_reached" | "no_subscription" | "no_organization" };

/**
 * Atomically increment aiDraftsUsed for the user's org and current month.
 * Performs the entitlement check in the same call so callers can't bypass it.
 *
 * Side effects on success:
 *   - usage_counters row upserted (created if missing)
 *   - audit log "ai_draft_generated" written
 *
 * Returns { ok: false } when:
 *   - user has no organization
 *   - subscription does not allow AI generation (status check)
 *   - usage already at or above the monthly limit
 */
export async function incrementAiDraftUsage(
  clerkUserId: string
): Promise<IncrementResult> {
  const account = await getCurrentAccount(clerkUserId);

  if (!account.organization || !account.user?.organizationId) {
    return { ok: false, reason: "no_organization" };
  }
  if (!account.access.canGenerateAiDraft) {
    return {
      ok: false,
      reason: account.access.reason === "ai_draft_limit_reached"
        ? "limit_reached"
        : "no_subscription",
    };
  }

  const orgId = account.user.organizationId;
  const limit = account.entitlements?.maxAiDraftsPerMonth ?? 0;
  const month = currentMonthIso();

  // Mock fallback: pretend it worked
  if (!isDbConnected()) {
    return { ok: true, aiDraftsUsed: (account.usage?.aiDraftsUsed ?? 0) + 1, limit };
  }

  // Atomic upsert. Returns the new counter value.
  const [row] = await db
    .insert(usageCounters)
    .values({
      organizationId: orgId,
      month,
      aiDraftsUsed:    1,
      emailsProcessed: 0,
    })
    .onConflictDoUpdate({
      target: [usageCounters.organizationId, usageCounters.month],
      set: {
        aiDraftsUsed: sql`${usageCounters.aiDraftsUsed} + 1`,
        updatedAt:    new Date(),
      },
    })
    .returning({ aiDraftsUsed: usageCounters.aiDraftsUsed });

  // Best-effort audit log; don't fail the call if logging fails.
  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "ai_draft_generated",
    metadata:       { month, newCount: row?.aiDraftsUsed },
  }).catch((err) => {
    console.warn("[usage] audit log failed:", err);
  });

  return { ok: true, aiDraftsUsed: row?.aiDraftsUsed ?? 0, limit };
}

/**
 * Increment emailsProcessed for the user's org. Used when an inbound email
 * is received and processed — separate from AI draft counter.
 */
export async function incrementEmailsProcessed(
  organizationId: string,
  by = 1
): Promise<void> {
  if (!isDbConnected()) return;

  const month = currentMonthIso();
  await db
    .insert(usageCounters)
    .values({
      organizationId,
      month,
      aiDraftsUsed:    0,
      emailsProcessed: by,
    })
    .onConflictDoUpdate({
      target: [usageCounters.organizationId, usageCounters.month],
      set: {
        emailsProcessed: sql`${usageCounters.emailsProcessed} + ${by}`,
        updatedAt:       new Date(),
      },
    });
}

/**
 * Read-only helper: get the current month's counter for an org, or null.
 * Public-safe to call from any server route.
 */
export async function getCurrentMonthCounter(
  organizationId: string
) {
  if (!isDbConnected()) return null;
  const month = currentMonthIso();
  const rows = await db
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.organizationId, organizationId),
        eq(usageCounters.month, month)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}
