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
  users,
  type Subscription,
} from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  getThread,
  listMessages,
  getAiSettings,
  listCaseTypes,
  createDraft,
  findPendingDraft,
  updateThread,
  defaultAiSettings,
} from "./threads";
import { listActiveKnowledge } from "./knowledge";
import { generateDraft, AiTransientError } from "./ai";
import { writeAuditLog } from "./audit";
import { computeAccess } from "./entitlements";
import { fireWebhooksForThread } from "./webhooks";
import { notifyNewThread } from "./notify";
import { canAutoSend, executeSendDraft } from "./autoSend";
import { isBlocked } from "./blocklist";

function currentMonthIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
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
}): Promise<{ ok: true; draftId: string; autoSent?: boolean } | { ok: false; reason: string }> {
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
    user:         { id: "system", clerkUserId: "", organizationId, email: "", role: "owner", locale: "sv", createdAt: new Date(), updatedAt: new Date() },
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

  // Skip if there's already a pending/edited draft — prevents duplicate drafts
  // when Pub/Sub delivers the same notification twice or manual + auto trigger race.
  const existingDraft = await findPendingDraft(threadId);
  if (existingDraft) {
    return { ok: false, reason: "draft_already_pending" };
  }

  const [messages, settings, caseTypesList, knowledge] = await Promise.all([
    listMessages(threadId),
    getAiSettings(organizationId),
    listCaseTypes(organizationId),
    listActiveKnowledge(organizationId),
  ]);

  // Dry-run mode: generate + log but do NOT auto-send.
  // The `isDryRun` flag is written to the draft row so admin can review quality.
  const isDryRun = settings?.dryRunEnabled ?? false;

  // Generate
  let ai;
  try {
    ai = await generateDraft({
      organizationName: orgRow.name,
      settings: settings ?? defaultAiSettings(organizationId),
      caseTypes: caseTypesList,
      knowledge,
      thread,
      messages,
      newEmailBody,
    });
  } catch (err) {
    if (err instanceof AiTransientError) {
      await writeAuditLog({
        organizationId,
        userId: null,
        action: "ai_draft_skipped",
        metadata: {
          threadId,
          reason: "ai_transient_error",
          error: err.message,
        },
      });
      return { ok: false, reason: "ai_transient_error" };
    }
    throw err; // Re-throw other errors
  }

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
    isDryRun,
  });

  // Auto-classify: write case_type back to thread immediately so inbox
  // filtering and stats work without waiting for the agent to send the draft.
  if (ai.output.action === "summarize" && ai.output.case_type) {
    await updateThread(organizationId, threadId, {
      caseTypeSlug: ai.output.case_type,
    });
    // Fire webhooks for classified thread (non-blocking)
    fireWebhooksForThread(organizationId, {
      id:           threadId,
      caseTypeSlug: ai.output.case_type ?? null,
      fromEmail:    thread.fromEmail,
      subject:      thread.subject ?? null,
    }).catch(() => {});
  } else if (ai.output.action === "ask" && ai.output.collected_info) {
    // Even on "ask", merge any partial collected_info into the thread
    const merged = { ...(thread.collectedInfo ?? {}), ...ai.output.collected_info };
    if (Object.keys(merged).length > 0) {
      await updateThread(organizationId, threadId, { collectedInfo: merged });
    }
  }

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

  // ── Auto-send ──────────────────────────────────────────────────────────────
  // Only when autoSendEnabled AND not dry-run AND draft was created.
  let autoSent = false;
  if (!isDryRun && draft && settings?.autoSendEnabled) {
    const meta = draft.metadata as Record<string, unknown> | null;
    const confidence      = typeof meta?.confidence === "number"  ? meta.confidence      : 0;
    const riskLevel       = (meta?.risk_level as "low" | "medium" | "high") ?? "medium";
    const sourceGrounded  = typeof meta?.source_grounded === "boolean" ? meta.source_grounded : false;

    const decision = canAutoSend({
      action:           ai.output.action,
      confidence,
      riskLevel,
      sourceGrounded,
      interactionCount: thread.interactionCount,
      isBlocked:        await isBlocked(organizationId, thread.fromEmail),
    });

    if (decision.eligible) {
      const sendResult = await executeSendDraft({
        orgId:   organizationId,
        draftId: draft.id,
        userId:  null, // system-triggered
      });
      autoSent = sendResult.ok;
      if (!sendResult.ok) {
        console.warn("[autoTriage] auto-send failed:", sendResult.error, "— draft stays pending for manual review");
      }
    } else {
      // Log why auto-send was blocked (non-fatal)
      await writeAuditLog({
        organizationId,
        userId: null,
        action: "ai_draft_generated",
        metadata: {
          threadId,
          draftId:         draft.id,
          action:          ai.output.action,
          source:          "auto_triage",
          auto_send_blocked: decision.blockers,
        },
      });
    }
  }

  // Notify org owner about new inbound thread (non-blocking).
  // Skipped in dry-run mode — no real email action was taken.
  if (!isDryRun) {
    try {
      const ownerRow = await db
        .select()
        .from(users)
        .where(and(
          eq(users.organizationId, organizationId),
          eq(users.role, "owner"),
        ))
        .limit(1)
        .then(r => r[0] ?? null);
      if (ownerRow?.email) {
        notifyNewThread({
          toEmail:   ownerRow.email,
          fromName:  thread.fromName,
          fromEmail: thread.fromEmail,
          subject:   thread.subject ?? null,
          threadId,
        }).catch(() => {});
      }
    } catch {
      // Never let notification failure break the triage flow
    }
  }

  await writeAuditLog({
    organizationId,
    userId: null,
    action: isDryRun ? "ai_dry_run_generated" : "ai_draft_generated",
    metadata: {
      threadId,
      draftId:  draft?.id ?? null,
      action:   ai.output.action,
      source:   "auto_triage",
      dry_run:  isDryRun,
    },
  });

  return draft ? { ok: true, draftId: draft.id, autoSent } : { ok: false, reason: "draft_create_failed" };
}

// Re-export the subscription type for callers that need it
export type { Subscription };
