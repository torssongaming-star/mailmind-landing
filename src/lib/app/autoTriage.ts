/**
 * Auto-triage entry point.
 *
 * Generates an AI draft for a thread WITHOUT requiring a Clerk user — used
 * by the inbound webhook (which is unauthenticated). Performs the same
 * entitlement checks as the manual route, but org-scoped via the inbox
 * lookup chain (webhook resolves org from `to:` address).
 *
 * Usage check uses the org's plan/limits directly, not a Clerk userId.
 */

import { sql } from "drizzle-orm";
import {
  db,
  isDbConnected,
  organizations,
  subscriptions,
  licenseEntitlements,
  usageCounters,
  type Subscription,
} from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  getThread,
  listMessages,
  getAiSettings,
  listCaseTypes,
  createDraft,
  defaultAiSettings,
} from "./threads";
import { listActiveKnowledge } from "./knowledge";
import { generateDraft } from "./ai";
import { writeAuditLog } from "./audit";
import { computeAccess } from "./entitlements";

function currentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

/**
 * Generate an AI draft for the given thread, on behalf of the org.
 * Returns the created draft id, or null if entitlement check failed
 * (caller logs but doesn't error — the thread still exists for human review).
 */
export async function autoTriageNewMessage(input: {
  organizationId: string;
  threadId: string;
  newEmailBody: string;
}): Promise<{ ok: true; draftId: string } | { ok: false; reason: string }> {
  const { organizationId, threadId, newEmailBody } = input;

  if (!isDbConnected()) {
    return { ok: false, reason: "db_unavailable" };
  }

  // Load org / sub / entitlements / current-month usage in parallel
  const month = currentMonthIso();
  const [orgRow, subRow, entitlementsRow, usageRow] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).then(r => r[0] ?? null),
    db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).orderBy(desc(subscriptions.createdAt)).limit(1).then(r => r[0] ?? null),
    db.select().from(licenseEntitlements).where(eq(licenseEntitlements.organizationId, organizationId)).limit(1).then(r => r[0] ?? null),
    db.select().from(usageCounters).where(and(
      eq(usageCounters.organizationId, organizationId),
      eq(usageCounters.month, month),
    )).limit(1).then(r => r[0] ?? null),
  ]);

  if (!orgRow) return { ok: false, reason: "org_missing" };

  // Compute access — passing a stub user since this is a system-triggered call
  const access = computeAccess({
    user:         { id: "system", clerkUserId: "", organizationId, email: "", role: "owner", createdAt: new Date(), updatedAt: new Date() },
    subscription: subRow,
    entitlements: entitlementsRow,
    usage:        usageRow,
  });

  if (!access.canGenerateAiDraft) {
    return { ok: false, reason: access.reason };
  }

  // Load thread + history + AI config
  const thread = await getThread(organizationId, threadId);
  if (!thread) return { ok: false, reason: "thread_missing" };

  const [messages, settings, caseTypesList, knowledge] = await Promise.all([
    listMessages(threadId),
    getAiSettings(organizationId),
    listCaseTypes(organizationId),
    listActiveKnowledge(organizationId),
  ]);

  // Generate
  const ai = await generateDraft({
    organizationName: orgRow.name,
    settings:         settings ?? defaultAiSettings(organizationId),
    caseTypes:        caseTypesList,
    knowledge,
    thread,
    messages,
    newEmailBody,
  });

  // Persist as pending draft
  let bodyText: string | null = null;
  let metadata: Record<string, unknown> = { rawText: ai.rawText, source: "auto_triage" };
  switch (ai.output.action) {
    case "ask":
      bodyText = ai.output.question;
      metadata = { ...metadata, collected_info: ai.output.collected_info };
      break;
    case "summarize":
      bodyText = ai.output.customer_reply;
      metadata = {
        ...metadata,
        case_type:      ai.output.case_type,
        summary:        ai.output.summary,
        collected_info: ai.output.collected_info,
      };
      break;
    case "escalate":
      metadata = { ...metadata, reason: ai.output.reason };
      break;
  }

  const draft = await createDraft({
    organizationId,
    threadId,
    userId:    null, // system-triggered
    action:    ai.output.action,
    bodyText,
    metadata,
    aiModel:   ai.model,
  });

  // Increment usage atomically (inline, since we don't have a Clerk userId)
  await db
    .insert(usageCounters)
    .values({ organizationId, month, aiDraftsUsed: 1, emailsProcessed: 0 })
    .onConflictDoUpdate({
      target: [usageCounters.organizationId, usageCounters.month],
      set: {
        aiDraftsUsed: sql`${usageCounters.aiDraftsUsed} + 1`,
        updatedAt:    new Date(),
      },
    });

  await writeAuditLog({
    organizationId,
    userId: null,
    action: "ai_draft_generated",
    metadata: {
      threadId,
      draftId: draft?.id ?? null,
      action:  ai.output.action,
      source:  "auto_triage",
    },
  });

  return draft ? { ok: true, draftId: draft.id } : { ok: false, reason: "draft_create_failed" };
}

// Re-export the subscription type for callers that need it
export type { Subscription };
