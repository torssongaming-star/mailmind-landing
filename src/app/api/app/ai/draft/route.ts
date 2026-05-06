/**
 * POST /api/app/ai/draft
 *
 * Generate an AI draft reply for an existing thread. Steps:
 *   1. Auth (Clerk)
 *   2. Resolve org + check entitlements (assertCanGenerateAiDraft)
 *   3. Load thread + messages (scoped to user's org)
 *   4. Load AI settings + case types
 *   5. Call Claude (lib/app/ai.generateDraft)
 *   6. Persist draft (status=pending — needs human approval)
 *   7. Increment usage + audit log
 *   8. Return { draft }
 *
 * The new email body must come from the latest customer message in the thread,
 * OR be passed explicitly in the request body for ad-hoc drafts.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { assertCanGenerateAiDraft } from "@/lib/app/entitlements";
import { incrementAiDraftUsage } from "@/lib/app/usage";
import { writeAuditLog } from "@/lib/app/audit";
import {
  getThread,
  listMessages,
  getAiSettings,
  listCaseTypes,
  createDraft,
  defaultAiSettings,
} from "@/lib/app/threads";
import { generateDraft } from "@/lib/app/ai";

export const runtime = "nodejs";

const Body = z.object({
  threadId:     z.string().uuid(),
  /** Optional override; defaults to the latest customer message body */
  newEmailBody: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse + validate body
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { threadId, newEmailBody: bodyOverride } = parsed.data;

  // Entitlement guard — also returns the account so we don't refetch
  const guard = await assertCanGenerateAiDraft(userId);
  if (!guard.ok) {
    return NextResponse.json({ error: "Not allowed", reason: guard.reason }, { status: 403 });
  }
  const account = guard.account;
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  const orgId = account.organization.id;

  // Load thread (org-scoped)
  const thread = await getThread(orgId, threadId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Load conversation
  const messages = await listMessages(threadId);

  // Determine the customer message to act on. Prefer explicit override; else
  // use the latest customer-role message in the thread.
  const newEmailBody = bodyOverride
    ?? [...messages].reverse().find(m => m.role === "customer")?.bodyText
    ?? "";
  if (!newEmailBody.trim()) {
    return NextResponse.json({ error: "Thread has no customer message to reply to" }, { status: 400 });
  }

  // Load org-specific AI config
  const settings = (await getAiSettings(orgId)) ?? defaultAiSettings(orgId);
  const caseTypes = await listCaseTypes(orgId);

  // Generate
  const ai = await generateDraft({
    organizationName: account.organization.name,
    settings,
    caseTypes,
    thread,
    messages,
    newEmailBody,
  });

  // Persist as pending draft. body_text varies by action:
  //   ask        -> the question
  //   summarize  -> the customer-facing confirmation
  //   escalate   -> null (metadata.reason explains)
  let bodyText: string | null = null;
  let metadata: Record<string, unknown> = { rawText: ai.rawText };

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
      bodyText = null;
      metadata = { ...metadata, reason: ai.output.reason };
      break;
  }

  const draft = await createDraft({
    organizationId: orgId,
    threadId:       threadId,
    userId:         account.user.id,
    action:         ai.output.action,
    bodyText,
    metadata,
    aiModel:        ai.model,
  });

  // Track usage + audit (after successful persistence)
  const usage = await incrementAiDraftUsage(userId);

  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "ai_draft_generated",
    metadata: {
      threadId,
      draftId: draft?.id ?? null,
      action:  ai.output.action,
      model:   ai.model,
    },
  });

  return NextResponse.json({
    draft,
    usage: usage.ok ? { aiDraftsUsed: usage.aiDraftsUsed, limit: usage.limit } : null,
  });
}
