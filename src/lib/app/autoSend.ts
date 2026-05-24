/**
 * Auto-send pipeline.
 *
 * Two concerns in one file:
 *
 * 1. canAutoSend() — pure eligibility check based on the four locked rules
 *    from docs/roadmap/mailmind-sverige-mvp.md §5. Testable in isolation.
 *
 * 2. executeSendDraft() — extracted send logic (shared by the PATCH route and
 *    the auto-triage pipeline). Sends via Resend, appends the assistant message,
 *    and updates draft + thread status.
 *
 * LOCKED RULES (all four must pass for auto-send):
 *   1. Confidence ≥ 90 %
 *   2. Source-grounded answer (traceable to knowledge base or thread history)
 *   3. Risk level = "low" AND action ≠ "escalate"
 *   4. Not a new customer (interactionCount ≥ 3) AND not manually blocked
 */

import { eq, or, and } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, isDbConnected, inboxes as inboxesTable, users, aiDrafts } from "@/lib/db";
import {
  getDraft,
  updateDraft,
  updateThread,
  getThread,
  appendMessage,
  getAiSettings,
  listMessages,
  setThreadExternalId,
} from "./threads";
import { sendEmail, replySubject, appendSignature, appendHtmlSignature } from "./email";
import { textToHtml, htmlToText } from "../utils/html";
import { writeAuditLog } from "./audit";
import {
  decryptTokens as gmailDecryptTokens,
  encryptTokens as gmailEncryptTokens,
  refreshAccessToken as gmailRefreshAccessToken,
  sendViaGmail,
  type GmailInboxConfig,
} from "./gmail";
import {
  decryptTokens as outlookDecryptTokens,
  encryptTokens as outlookEncryptTokens,
  refreshAccessToken as outlookRefreshAccessToken,
  sendViaOutlook,
  type OutlookInboxConfig,
} from "./outlook";
import { getValidAccessTokenLocked } from "./inbox-token-refresh";

// ── Rule 1: confidence threshold ─────────────────────────────────────────────
export const AUTO_SEND_CONFIDENCE_THRESHOLD = 0.90;

// ── Eligibility check ─────────────────────────────────────────────────────────

export type AutoSendParams = {
  action:           "ask" | "summarize" | "escalate";
  confidence:       number;
  riskLevel:        "low" | "medium" | "high";
  sourceGrounded:   boolean;
  /** Total interactions the org has had with this thread's sender */
  interactionCount: number;
  /** Manually blocked by Mailmind team (future: per-sender flag) */
  isBlocked:        boolean;
};

export type AutoSendDecision =
  | { eligible: true }
  | { eligible: false; blockers: string[] };

/**
 * Pure function — no DB, no side effects.
 * Returns { eligible: true } or { eligible: false, blockers: [...] }.
 *
 * All four rules must pass simultaneously.
 */
export function canAutoSend(params: AutoSendParams): AutoSendDecision {
  const blockers: string[] = [];

  // Rule 1 — Confidence ≥ 90 %
  if (params.confidence < AUTO_SEND_CONFIDENCE_THRESHOLD) {
    blockers.push(`confidence_too_low (${(params.confidence * 100).toFixed(0)}% < 90%)`);
  }

  // Rule 2 — Source-grounded answer
  if (!params.sourceGrounded) {
    blockers.push("not_source_grounded");
  }

  // Rule 3 — Risk level low + not an escalation
  if (params.riskLevel !== "low") {
    blockers.push(`risk_level_${params.riskLevel}`);
  }
  if (params.action === "escalate") {
    blockers.push("action_is_escalate");
  }

  // Rule 4 — Not a new customer, not blocked
  if (params.interactionCount < 3) {
    blockers.push(`new_customer (${params.interactionCount} interactions < 3)`);
  }
  if (params.isBlocked) {
    blockers.push("sender_blocked");
  }

  return blockers.length === 0
    ? { eligible: true }
    : { eligible: false, blockers };
}

// ── Send execution ────────────────────────────────────────────────────────────

export type SendDraftResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sends a pending draft via Resend, appends the assistant message to the
 * conversation log, and transitions draft + thread status.
 *
 * Used by:
 *   - PATCH /api/app/drafts/[id] (human-triggered send)
 *   - autoTriageNewMessage (auto-send when autoSendEnabled)
 *
 * Returns { ok: false } on Resend failure — caller decides whether to surface
 * the error or leave the draft pending for manual review.
 */
export async function executeSendDraft(params: {
  orgId:   string;
  draftId: string;
  /** Optional — userId of the human who triggered the send (null for auto) */
  userId:  string | null;
}): Promise<SendDraftResult> {
  const { orgId, draftId, userId } = params;

  if (!isDbConnected()) return { ok: false, error: "db_unavailable" };

  // Atomic claim: flip status to "sending" only if still pending/edited.
  // If two concurrent callers race (double-click or cron+manual collision),
  // only one UPDATE returns a row — the other bails here. No duplicate sends.
  const [claimed] = await db
    .update(aiDrafts)
    .set({ status: "sending", updatedAt: new Date() })
    .where(and(
      eq(aiDrafts.id, draftId),
      eq(aiDrafts.organizationId, orgId),
      or(
        eq(aiDrafts.status, "pending"),
        eq(aiDrafts.status, "edited"),
      ),
    ))
    .returning();

  if (!claimed) {
    // Either draft doesn't exist, wrong org, or already claimed/sent/rejected.
    const draft = await getDraft(orgId, draftId);
    if (!draft) return { ok: false, error: "draft_not_found" };
    return { ok: false, error: `draft_already_${draft.status}` };
  }

  const draft = claimed;

  // Revert helper: if anything goes wrong before/during send, put the draft
  // back to "pending" so humans can retry. Best-effort — log but don't throw.
  const revert = async () => {
    try {
      await updateDraft(orgId, draftId, { status: "pending" });
    } catch (e) {
      Sentry.captureException(e, { tags: { component: "autoSend" } });
      console.error("[autoSend] failed to revert draft status:", e);
    }
  };

  const thread = await getThread(orgId, draft.threadId);
  if (!thread) { await revert(); return { ok: false, error: "thread_not_found" }; }

  const now = new Date();

  // Escalations don't send to customer — just update statuses
  if (draft.action !== "escalate") {
    if (!draft.bodyText?.trim()) {
      await revert(); return { ok: false, error: "no_body_text" };
    }

    // Resolve inbox
    let inboxEmail: string | undefined;
    let inboxProvider: string | undefined;
    let inboxRow: typeof inboxesTable.$inferSelect | undefined;
    if (thread.inboxId) {
      const rows = await db
        .select()
        .from(inboxesTable)
        .where(eq(inboxesTable.id, thread.inboxId))
        .limit(1);
      inboxRow      = rows[0];
      inboxEmail    = inboxRow?.email;
      inboxProvider = inboxRow?.provider ?? undefined;
    }

    // Threading headers
    const messages = await listMessages(orgId, draft.threadId);
    const priorIds = messages
      .map(m => m.externalMessageId)
      .filter((x): x is string => !!x);
    const lastCustomerMsg = [...messages].reverse().find(m => m.role === "customer");
    const inReplyTo  = lastCustomerMsg?.externalMessageId ?? null;
    const references = priorIds.length > 0 ? priorIds.join(" ") : null;

    // Signatures — only apply if the sending user has appendSignature enabled
    const settings = await getAiSettings(orgId);
    let signatureToUse: string | null = null;

    if (userId) {
      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userRows[0];
      // User-level signature takes priority, but only if they've opted in (default: true)
      if (user?.appendSignature !== false) {
        if (user?.signature?.trim()) {
          signatureToUse = user.signature;
        } else if (settings?.signature?.trim()) {
          signatureToUse = settings.signature;
        }
      }
    } else if (settings?.signature?.trim()) {
      // System-triggered sends (no userId) always use org signature
      signatureToUse = settings.signature;
    }

    // Prepare HTML and Plain Text bodies
    const htmlBodyBase = textToHtml(draft.bodyText);
    const finalHtmlBody = appendHtmlSignature(htmlBodyBase, signatureToUse);
    const signatureText = signatureToUse ? htmlToText(signatureToUse) : null;
    const finalBodyText = appendSignature(draft.bodyText, signatureText);
    
    const subject = replySubject(thread.subject);

    let sentMessageId: string | null = null;

    if (inboxProvider === "gmail" && inboxRow) {
      // ── Send via Gmail API ───────────────────────────────────────────────
      const config = inboxRow.config as GmailInboxConfig | null;
      if (!config?.encryptedTokens) {
        await revert(); return { ok: false, error: "gmail_no_tokens" };
      }

      // Locked per-inbox refresh — prevents concurrent senders/webhooks from
      // racing on Google's refresh_token endpoint and invalidating each other.
      const { accessToken } = await getValidAccessTokenLocked(inboxRow.id, config, {
        decrypt: gmailDecryptTokens,
        encrypt: gmailEncryptTokens,
        refresh: gmailRefreshAccessToken,
      });

      const gmailResult = await sendViaGmail(accessToken, {
        from:          inboxEmail!,
        to:            thread.fromEmail,
        subject,
        text:          finalBodyText,
        html:          finalHtmlBody,
        inReplyTo,
        references,
        gmailThreadId: thread.externalThreadId,
      });

      if (!gmailResult.ok) {
        await revert(); return { ok: false, error: `gmail_send_error: ${gmailResult.error}` };
      }
      sentMessageId = gmailResult.messageId;
      // Ensure thread is linked to the Gmail thread so replies are grouped correctly
      if (!thread.externalThreadId) {
        await setThreadExternalId(orgId, draft.threadId, gmailResult.gmailThreadId);
      }

    } else if (inboxProvider === "outlook" && inboxRow) {
      // ── Send via Microsoft Graph API ─────────────────────────────────────
      const config = inboxRow.config as OutlookInboxConfig | null;
      if (!config?.encryptedTokens) {
        await revert(); return { ok: false, error: "outlook_no_tokens" };
      }

      // Locked per-inbox refresh — same rationale as the Gmail path above.
      const { accessToken } = await getValidAccessTokenLocked(inboxRow.id, config, {
        decrypt: outlookDecryptTokens,
        encrypt: outlookEncryptTokens,
        refresh: outlookRefreshAccessToken,
      });

      const outlookResult = await sendViaOutlook(accessToken, {
        from:       inboxEmail!,
        to:         thread.fromEmail,
        subject,
        text:       finalBodyText,
        html:       finalHtmlBody,
        inReplyTo,
        references,
      });

      if (!outlookResult.ok) {
        await revert(); return { ok: false, error: `outlook_send_error: ${outlookResult.error}` };
      }
      sentMessageId = outlookResult.messageId;

    } else {
      // ── Send via Resend ──────────────────────────────────────────────────
      const headers: Record<string, string> = {};
      if (inReplyTo)  headers["In-Reply-To"] = inReplyTo;
      if (references) headers["References"]  = references;

      const result = await sendEmail({
        to:      thread.fromEmail,
        subject,
        text:    finalBodyText,
        html:    finalHtmlBody,
        replyTo: inboxEmail,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });

      if (!result.ok) {
        await revert(); return { ok: false, error: `resend_error: ${result.error}` };
      }
      sentMessageId = result.id ?? null;
    }

    await appendMessage({
      threadId:          draft.threadId,
      role:              "assistant",
      bodyText:          finalBodyText,
      externalMessageId: sentMessageId,
      sentAt:            now,
    });

    // For forwarded inboxes (Resend): use the message ID as external thread ID if not set
    if (inboxProvider !== "gmail" && inboxProvider !== "outlook" && !thread.externalThreadId && sentMessageId) {
      await setThreadExternalId(orgId, draft.threadId, sentMessageId);
    }
  }

  // Update draft
  await updateDraft(orgId, draftId, {
    status:     "sent",
    approvedAt: now,
    sentAt:     now,
  });

  // Thread status transition
  const newStatus =
    draft.action === "ask"       ? "waiting"   :
    draft.action === "summarize" ? "resolved"  :
    "escalated";

  const interactionCount =
    draft.action === "ask"
      ? thread.interactionCount + 1
      : thread.interactionCount;

  const caseTypeSlug =
    draft.action === "summarize"
      ? ((draft.metadata as { case_type?: string })?.case_type ?? thread.caseTypeSlug)
      : thread.caseTypeSlug;

  const mergedInfo = mergeCollected(thread.collectedInfo, draft.metadata);

  await updateThread(orgId, draft.threadId, {
    status:           newStatus as "open" | "waiting" | "escalated" | "resolved",
    interactionCount,
    caseTypeSlug,
    collectedInfo:    mergedInfo,
    lastMessageAt:    now,
  });

  // Audit
  const auditAction =
    draft.action === "escalate" ? "thread_escalated"  :
    draft.action === "summarize" ? "thread_resolved" :
    "ai_draft_sent";

  await writeAuditLog({
    organizationId: orgId,
    userId,
    action: auditAction,
    metadata: {
      draftId,
      draftAction:     draft.action,
      threadId:        draft.threadId,
      newThreadStatus: newStatus,
      autoSent:        userId === null,
    },
  });

  return { ok: true };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function mergeCollected(
  existing: Record<string, unknown> | null | undefined,
  metadata: unknown,
): Record<string, unknown> {
  const ci = (metadata as { collected_info?: Record<string, unknown> })?.collected_info;
  if (!ci || typeof ci !== "object") return existing ?? {};
  return { ...(existing ?? {}), ...ci };
}
