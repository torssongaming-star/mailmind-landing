/**
 * POST /api/app/threads/:id/retry-triage
 *
 * Manually re-triggers autoTriage for a thread that previously failed
 * (triageFailed === true). Used by the "Triage igen" button in the UI
 * when Anthropic was down during initial processing.
 *
 * Org-scoped — user must belong to the org that owns the thread.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getThread, listMessages, updateThread } from "@/lib/app/threads";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  if (!account.access.canGenerateAiDraft) {
    return NextResponse.json({ error: "AI draft limit reached" }, { status: 403 });
  }

  const { id: threadId } = await params;
  const orgId = account.organization.id;

  const thread = await getThread(orgId, threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // Optional body — { bypassBulk: true } when the user clicks
  // "Detta är inte reklam" on a bulk-classified thread.
  const body = await req.json().catch(() => ({}));
  const bypassBulk = Boolean((body as { bypassBulk?: boolean })?.bypassBulk);

  // When unflagging a bulk thread, restore status + clear caseTypeSlug so
  // the thread leaves the "Reklam" tab and appears in the normal inbox.
  if (bypassBulk && thread.caseTypeSlug === "bulk") {
    await updateThread(orgId, threadId, {
      status:       "open",
      caseTypeSlug: null,
    });
  }

  // Fetch the latest customer message to re-feed into the triage pipeline.
  const messages = await listMessages(orgId, threadId);
  const lastCustomer = [...messages].reverse().find(m => m.role === "customer");
  if (!lastCustomer) {
    return NextResponse.json({ error: "No customer message to triage" }, { status: 400 });
  }

  const result = await autoTriageNewMessage({
    organizationId:   orgId,
    threadId,
    newEmailBody:     lastCustomer.bodyText ?? "",
    bypassBulkFilter: bypassBulk,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  return NextResponse.json({ ok: true, draftId: result.draftId });
}
