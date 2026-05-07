/**
 * PATCH /api/app/drafts/:id
 *
 * Single endpoint for all draft lifecycle actions:
 *   { action: "edit",   bodyText: "..." }  → update body, status stays pending
 *   { action: "send" }                     → dispatch email + mark sent + update thread
 *   { action: "reject" }                   → mark rejected, no email
 *
 * "Approve" is implicit in "send" — there's no separate approve step in the
 * MVP because the human reviews by clicking Send.
 *
 * The send path is where status transitions for the THREAD also happen:
 *   draft.action === "ask"       → thread status = waiting, interaction_count++
 *   draft.action === "summarize" → thread status = resolved
 *   draft.action === "escalate"  → thread status = escalated, NO email to customer
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import {
  getThread,
  getDraft,
  updateDraft,
  updateThread,
  appendMessage,
  getAiSettings,
  listMessages,
  setThreadExternalId,
} from "@/lib/app/threads";
import { eq } from "drizzle-orm";
import { db, isDbConnected, inboxes as inboxesTable } from "@/lib/db";
import { sendEmail, replySubject, appendSignature } from "@/lib/app/email";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), bodyText: z.string().min(1) }),
  z.object({ action: z.literal("send") }),
  z.object({ action: z.literal("reject") }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const { id: draftId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orgId = account.organization.id;

  const draft = await getDraft(orgId, draftId);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  // Only pending drafts can be modified. Once sent/rejected, they're frozen.
  if (draft.status !== "pending") {
    return NextResponse.json({ error: `Draft is ${draft.status} and cannot be modified` }, { status: 409 });
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  if (parsed.data.action === "edit") {
    if (draft.action === "escalate") {
      return NextResponse.json({ error: "Escalate drafts have no editable body" }, { status: 400 });
    }
    await updateDraft(orgId, draftId, {
      bodyText: parsed.data.bodyText,
      status:   "edited",
    });
    await writeAuditLog({
      organizationId: orgId,
      userId:         account.user.id,
      action:         "ai_draft_edited",
      metadata:       { draftId },
    });
    return NextResponse.json({ ok: true, status: "edited" });
  }

  // ── REJECT ────────────────────────────────────────────────────────────────
  if (parsed.data.action === "reject") {
    await updateDraft(orgId, draftId, { status: "rejected" });
    await writeAuditLog({
      organizationId: orgId,
      userId:         account.user.id,
      action:         "ai_draft_rejected",
      metadata:       { draftId },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // ── SEND ──────────────────────────────────────────────────────────────────
  // Loads the thread so we know who to email and how to update status afterwards.
  const thread = await getThread(orgId, draft.threadId);
  if (!thread) return NextResponse.json({ error: "Thread missing" }, { status: 500 });

  const now = new Date();

  // For "ask" and "summarize" we send the customer-facing reply.
  // For "escalate" we don't send to the customer — just mark thread escalated.
  if (draft.action !== "escalate") {
    if (!draft.bodyText?.trim()) {
      return NextResponse.json({ error: "Draft has no body to send" }, { status: 400 });
    }

    // Resolve inbox so we can set Reply-To. When the customer replies, it lands
    // back at our SendGrid Inbound Parse endpoint and we can thread it.
    let replyTo: string | undefined;
    if (thread.inboxId && isDbConnected()) {
      const inboxRows = await db
        .select()
        .from(inboxesTable)
        .where(eq(inboxesTable.id, thread.inboxId))
        .limit(1);
      replyTo = inboxRows[0]?.email ?? undefined;
    }

    // Threading headers — In-Reply-To = last customer message id;
    // References = chain of all prior message ids in the thread.
    const messages = await listMessages(draft.threadId);
    const priorIds = messages
      .map(m => m.externalMessageId)
      .filter((x): x is string => !!x);
    const headers: Record<string, string> = {};
    const lastCustomerMsg = [...messages].reverse().find(m => m.role === "customer");
    if (lastCustomerMsg?.externalMessageId) {
      headers["In-Reply-To"] = lastCustomerMsg.externalMessageId;
    }
    if (priorIds.length > 0) {
      headers["References"] = priorIds.join(" ");
    }

    // Append signature from the org's AI settings (if any)
    const settings = await getAiSettings(orgId);
    const finalBody = appendSignature(draft.bodyText, settings?.signature);

    const result = await sendEmail({
      to:      thread.fromEmail,
      subject: replySubject(thread.subject),
      text:    finalBody,
      replyTo,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: `Email failed: ${result.error}` }, { status: 502 });
    }

    // Append assistant message to conversation log
    await appendMessage({
      threadId:           draft.threadId,
      role:               "assistant",
      bodyText:           finalBody,
      externalMessageId:  result.id || null,
      sentAt:             now,
    });

    // If the thread has no externalThreadId yet, set it to the outgoing
    // Message-ID. When the customer replies, their In-Reply-To header will
    // reference this ID, allowing the inbound webhook to thread the reply
    // into the existing conversation instead of creating a new thread.
    if (!thread.externalThreadId && result.id) {
      await setThreadExternalId(orgId, draft.threadId, result.id);
    }
  }

  // Update draft + thread status atomically (best effort — no real txn)
  await updateDraft(orgId, draftId, {
    status:     "sent",
    approvedAt: now,
    sentAt:     now,
  });

  // Thread status transitions per draft action
  let newStatus: "open" | "waiting" | "escalated" | "resolved" = thread.status;
  let interactionCount = thread.interactionCount;
  let caseTypeSlug = thread.caseTypeSlug;
  let collectedInfo = thread.collectedInfo;

  switch (draft.action) {
    case "ask":
      newStatus = "waiting";
      interactionCount = thread.interactionCount + 1;
      // Merge any collected_info from this draft into the thread
      collectedInfo = mergeCollected(thread.collectedInfo, draft.metadata);
      break;
    case "summarize":
      newStatus = "resolved";
      caseTypeSlug = (draft.metadata as { case_type?: string })?.case_type ?? caseTypeSlug;
      collectedInfo = mergeCollected(thread.collectedInfo, draft.metadata);
      break;
    case "escalate":
      newStatus = "escalated";
      break;
  }

  await updateThread(orgId, draft.threadId, {
    status:           newStatus,
    interactionCount,
    caseTypeSlug,
    collectedInfo,
    lastMessageAt:    now,
  });

  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action: draft.action === "escalate"
      ? "thread_escalated"
      : draft.action === "summarize"
        ? "thread_resolved"
        : "ai_draft_sent",
    metadata: {
      draftId,
      draftAction:     draft.action,
      threadId:        draft.threadId,
      newThreadStatus: newStatus,
    },
  });

  return NextResponse.json({ ok: true, status: "sent", threadStatus: newStatus });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function mergeCollected(
  existing: Record<string, unknown> | null | undefined,
  metadata: unknown,
): Record<string, unknown> {
  const ci = (metadata as { collected_info?: Record<string, unknown> })?.collected_info;
  if (!ci || typeof ci !== "object") return existing ?? {};
  return { ...(existing ?? {}), ...ci };
}
