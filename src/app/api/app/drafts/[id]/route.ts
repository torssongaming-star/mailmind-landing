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
import { getDraft, updateDraft } from "@/lib/app/threads";
import { executeSendDraft } from "@/lib/app/autoSend";
import { writeAuditLog } from "@/lib/app/audit";
import { trackEvent } from "@/lib/analytics";

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

  // Status check is per-action so the edit→send round-trip works. Edit and
  // send both accept pending+edited; send also tolerates "sending" so a
  // duplicate click doesn't 409 mid-flight. The atomic claim in
  // executeSendDraft is the real lock — see autoSend.ts.
  const canMutate = draft.status === "pending" || draft.status === "edited";
  if (!canMutate) {
    return NextResponse.json(
      { error: `Draft is ${draft.status} and cannot be modified` },
      { status: 409 },
    );
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
    void trackEvent({
      distinctId: userId,
      event:      "draft_rejected",
      properties: { org_id: orgId, draft_action: draft.action, source: "manual" },
      groups:     { organization: orgId },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // ── SEND ──────────────────────────────────────────────────────────────────
  const sendResult = await executeSendDraft({
    orgId,
    draftId,
    userId: account.user.id,
  });

  if (!sendResult.ok) {
    const status = sendResult.error.startsWith("resend_error") ? 502 : 500;
    return NextResponse.json({ error: sendResult.error }, { status });
  }

  // Analytics: milestone + per-send events (non-blocking)
  void Promise.all([
    trackEvent({
      distinctId: userId,
      event:      "first_ai_draft_sent",
      properties: { org_id: orgId, draft_id: draftId },
      groups:     { organization: orgId },
    }),
    trackEvent({
      distinctId: userId,
      event:      "draft_sent",
      properties: { org_id: orgId, draft_action: draft.action, source: "manual" },
      groups:     { organization: orgId },
    }),
  ]);

  // Look up the actual thread status — the draft's status is now "sent",
  // but the thread might be "open" / "waiting" / "resolved" / "escalated"
  // depending on what executeSendDraft transitioned it to.
  const { getThread } = await import("@/lib/app/threads");
  const sent = await getDraft(orgId, draftId);
  const thread = sent ? await getThread(orgId, sent.threadId) : null;
  return NextResponse.json({
    ok:           true,
    status:       "sent",
    threadStatus: thread?.status ?? null,
  });
}
