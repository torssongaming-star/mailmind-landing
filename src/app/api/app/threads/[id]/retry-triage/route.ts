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
import { db, isDbConnected, aiSettings } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getThread, listMessages, updateThread, getAiSettings, defaultAiSettings } from "@/lib/app/threads";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";

export const runtime = "nodejs";

/** Add a sender's domain (e.g. "@acme.se") to the org's bulk-filter whitelist
 *  if it's not already there. Idempotent. */
async function trustSenderDomain(orgId: string, fromEmail: string) {
  const at = fromEmail.lastIndexOf("@");
  if (at < 0) return;
  const domainEntry = fromEmail.slice(at).toLowerCase().trim();
  if (!domainEntry || domainEntry === "@") return;

  const current = (await getAiSettings(orgId)) ?? defaultAiSettings(orgId);
  const existing = current.bulkFilterWhitelist ?? [];
  if (existing.some(e => e.toLowerCase().trim() === domainEntry)) return; // already trusted

  const nextList = [...existing, domainEntry];

  if (!isDbConnected()) return;
  await db
    .insert(aiSettings)
    .values({
      organizationId:       orgId,
      tone:                 current.tone,
      language:             current.language,
      maxInteractions:      current.maxInteractions,
      signature:            current.signature,
      bulkFilterEnabled:    current.bulkFilterEnabled,
      bulkFilterWhitelist:  nextList,
    })
    .onConflictDoUpdate({
      target: aiSettings.organizationId,
      set: { bulkFilterWhitelist: nextList, updatedAt: new Date() },
    });
}

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

  // Optional body — { bypassBulk: true, trustSender?: true } when the user
  // clicks one of the override buttons on a bulk-classified thread.
  const body = await req.json().catch(() => ({}));
  const bypassBulk  = Boolean((body as { bypassBulk?:  boolean })?.bypassBulk);
  const trustSender = Boolean((body as { trustSender?: boolean })?.trustSender);

  // When unflagging a bulk thread, restore status + clear caseTypeSlug so
  // the thread leaves the "Reklam" tab and appears in the normal inbox.
  if (bypassBulk && thread.caseTypeSlug === "bulk") {
    await updateThread(orgId, threadId, {
      status:       "open",
      caseTypeSlug: null,
    });
  }

  // "Lita på avsändaren framöver" — adds sender's domain to the whitelist
  // so all future mail from this domain skips the heuristic filter.
  if (trustSender) {
    await trustSenderDomain(orgId, thread.fromEmail);
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
