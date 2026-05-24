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
import * as Sentry from "@sentry/nextjs";
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
  getCustomerHistory,
} from "./threads";
import { listActiveKnowledge } from "./knowledge";
import { generateDraft, AiTransientError, detectPromptInjection } from "./ai";
import { writeAuditLog } from "./audit";
import { trackEvent } from "@/lib/analytics";
import { computeAccess } from "./entitlements";
import { fireWebhooksForThread } from "./webhooks";
import { notifyNewThread } from "./notify";
import { canAutoSend, executeSendDraft } from "./autoSend";
import { isBlocked } from "./blocklist";
import { detectBulkEmail, type BulkHeaders } from "./bulk-filter";
import { sendPushToOrg } from "./push";

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
  /** Optional — when provided, enables header-based bulk filtering (Layer 0). */
  bulkHeaders?: BulkHeaders;
  /** When true, skip both the heuristic and AI bulk-classification gates.
   *  Used when a human explicitly clicks "Detta är inte reklam" so we trust
   *  their intent over the automatic classifier. */
  bypassBulkFilter?: boolean;
}): Promise<{ ok: true; draftId: string; autoSent?: boolean } | { ok: false; reason: string }> {
  const { organizationId, threadId, newEmailBody, bulkHeaders, bypassBulkFilter } = input;

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
    user:         { id: "system", clerkUserId: "", organizationId, email: "", role: "owner", locale: "sv", signature: null, appendSignature: true, createdAt: new Date(), updatedAt: new Date() },
    organization: orgRow,
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

  const [messages, settings, caseTypesList, knowledge, customerHistory] = await Promise.all([
    listMessages(organizationId, threadId),
    getAiSettings(organizationId),
    listCaseTypes(organizationId),
    listActiveKnowledge(organizationId),
    getCustomerHistory(organizationId, thread.fromEmail, threadId),
  ]);

  // ── Bulk / marketing filter ───────────────────────────────────────────────
  // Check BEFORE calling AI — saves cost and keeps inbox clean. Thread +
  // message are already in DB so the customer can audit filtered emails
  // in the "Reklam" tab. Org may disable via aiSettings.bulkFilterEnabled
  // or whitelist specific senders via aiSettings.bulkFilterWhitelist.
  const bulkSignal = bypassBulkFilter
    ? { detected: false as const }
    : detectBulkEmail({
        fromEmail: thread.fromEmail,
        subject:   thread.subject ?? "",
        bodyText:  newEmailBody,
        headers:   bulkHeaders,
        settings: {
          enabled:   settings?.bulkFilterEnabled ?? true,
          whitelist: settings?.bulkFilterWhitelist ?? [],
        },
      });
  if (bulkSignal.detected) {
    await updateThread(organizationId, threadId, {
      status:       "resolved",
      caseTypeSlug: "bulk",
    });
    await writeAuditLog({
      organizationId,
      action:   "email_filtered_bulk",
      metadata: {
        threadId,
        fromEmail: thread.fromEmail,
        layer:     bulkSignal.layer,
        reason:    bulkSignal.reason,
      },
    });
    return { ok: false, reason: "bulk_email_filtered" };
  }

  // Dry-run mode: generate + log but do NOT auto-send.
  // The `isDryRun` flag is written to the draft row so admin can review quality.
  const isDryRun = settings?.dryRunEnabled ?? false;

  // Prompt-injection detection — when input looks like a jailbreak attempt,
  // force isDryRun + flag for human review. AI may still try to handle it but
  // we never autosend.
  const injectionDetected = detectPromptInjection(newEmailBody);
  if (injectionDetected) {
    await writeAuditLog({
      organizationId,
      userId: null,
      action: "ai_draft_skipped",
      metadata: {
        threadId,
        reason: "prompt_injection_detected",
      },
    });
    // Do NOT call the AI — log and surface for human review.
    await updateThread(organizationId, threadId, { triageFailed: true }).catch(() => {});
    return { ok: false, reason: "prompt_injection_detected" };
  }

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
      customerHistory,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { component: "autoTriage", organizationId } });
    if (err instanceof AiTransientError) {
      // Mark thread so users know triage failed and can retry manually.
      await updateThread(organizationId, threadId, { triageFailed: true }).catch(() => {});
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

  // P3.6 — validera sources mot verkliga KB-IDs. Om AI:n hittat på ID:n
  // som inte finns, downgrade source_grounded → false (skyddar autosend).
  const validKbIds = new Set(knowledge.map(k => k.id));
  validKbIds.add("thread");
  validKbIds.add("history");
  const validatedSources = (ai.output.sources ?? []).filter(s => validKbIds.has(s.kb_entry_id));
  const fabricatedSources = (ai.output.sources?.length ?? 0) - validatedSources.length;
  if (fabricatedSources > 0) {
    console.warn(`[autoTriage] AI returned ${fabricatedSources} fabricated source IDs — dropping + setting source_grounded=false`);
  }
  const effectiveSourceGrounded = fabricatedSources > 0 ? false : ai.output.source_grounded;

  // Persist as pending draft
  let bodyText: string | null = null;
  let metadata: Record<string, unknown> = {
    rawText:         ai.rawText,
    source:          "auto_triage",
    confidence:      ai.output.confidence,
    risk_level:      ai.output.risk_level,
    source_grounded: effectiveSourceGrounded,
    sources:         validatedSources,
    fabricated_sources_dropped: fabricatedSources,
  };
  // ── AI-flagged bulk (Layer 2 backup for the heuristic filter) ─────────────
  // When AI returns "ignore", it has identified the mail as auto-generated /
  // bulk that the header- and heuristic-filter missed. Treat it like a
  // bulk-filter hit: resolve the thread, no draft, no customer reply.
  // Skipped when bypassBulkFilter — a human has already overruled the gate.
  if (!bypassBulkFilter && ai.output.action === "ignore") {
    await updateThread(organizationId, threadId, {
      status:       "resolved",
      caseTypeSlug: "bulk",
    });
    await writeAuditLog({
      organizationId,
      action:   "email_filtered_bulk",
      metadata: {
        threadId,
        fromEmail: thread.fromEmail,
        layer:     "ai_ignore",
        reason:    ai.output.reason,
      },
    });
    return { ok: false, reason: "bulk_email_filtered_by_ai" };
  }

  // When bypass is on and AI still wants to ignore, fall through to here.
  // Treat as escalate so the user gets a draft frame they can edit/send.
  const draftAction: "ask" | "summarize" | "escalate" =
    ai.output.action === "ignore" ? "escalate" : ai.output.action;

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
    case "ignore":
      // Only reachable when bypassBulkFilter is true — promoted to escalate.
      metadata = {
        ...metadata,
        reason: `Markerad som ej reklam av användare. AI:s ursprungliga bedömning: ${ai.output.reason}`,
      };
      break;
  }

  const draft = await createDraft({
    organizationId,
    threadId,
    userId:    null, // system-triggered
    action:    draftAction,
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

  // Detect first-ever AI draft for this org before incrementing the counter.
  // Only run the cross-month sum query when the current month shows zero drafts.
  const isFirstDraft = draft && (usageRow?.aiDraftsUsed ?? 0) === 0
    && !(await db
      .select({ s: sql<number>`coalesce(sum(${usageCounters.aiDraftsUsed}), 0)` })
      .from(usageCounters)
      .where(eq(usageCounters.organizationId, organizationId))
      .then(r => Number(r[0]?.s) > 0));

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

  if (isFirstDraft) {
    void trackEvent({
      distinctId: organizationId,
      event:      "first_ai_draft_generated",
      properties: { org_id: organizationId, source: "auto" },
      groups:     { organization: organizationId },
    });
  }

  // ── Auto-send ──────────────────────────────────────────────────────────────
  // Only when autoSendEnabled AND not dry-run AND draft was created.
  let autoSent = false;
  if (!isDryRun && draft && settings?.autoSendEnabled && !injectionDetected) {
    const meta = draft.metadata as Record<string, unknown> | null;
    const confidence      = typeof meta?.confidence === "number"  ? meta.confidence      : 0;
    const riskLevel       = (meta?.risk_level as "low" | "medium" | "high") ?? "medium";
    const sourceGrounded  = typeof meta?.source_grounded === "boolean" ? meta.source_grounded : false;

    const decision = canAutoSend({
      action:           draftAction,
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

      // Fire push notification to all team members with active subscriptions
      const senderLabel = thread.fromName ?? thread.fromEmail;
      sendPushToOrg(organizationId, {
        title: `Nytt ärende från ${senderLabel}`,
        body:  thread.subject ?? "(inget ämne)",
        url:   `/app/inbox?thread=${threadId}`,
        tag:   `thread-${threadId}`,
      }).catch(() => {});
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

  if (!draft) {
    await updateThread(organizationId, threadId, { triageFailed: true }).catch(() => {});
    return { ok: false, reason: "draft_create_failed" };
  }

  // Clear any previous failure flag now that triage succeeded.
  await updateThread(organizationId, threadId, { triageFailed: false }).catch(() => {});
  return { ok: true, draftId: draft.id, autoSent };
}

// Re-export the subscription type for callers that need it
export type { Subscription };
