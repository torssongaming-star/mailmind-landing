/**
 * /api/app/threads
 *
 * GET   — list threads for the user's org (sorted by latest activity)
 * POST  — create a thread + initial customer message (test/dev only until
 *         real inbox connectors land in Phase 3)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listThreads, createThread, appendMessage, updateThread } from "@/lib/app/threads";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const threads = await listThreads(account.organization.id, 100);
  return NextResponse.json({ threads });
}

const PostBody = z.object({
  fromEmail: z.string().email(),
  fromName:  z.string().trim().min(1).max(255).optional(),
  subject:   z.string().trim().min(1).max(500),
  body:      z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orgId = account.organization.id;
  const now = new Date();

  // Create thread + first customer message
  const thread = await createThread({
    organizationId: orgId,
    fromEmail:      parsed.data.fromEmail,
    fromName:       parsed.data.fromName,
    subject:        parsed.data.subject,
  });

  if (!thread) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  await appendMessage({
    threadId: thread.id,
    role:     "customer",
    bodyText: parsed.data.body,
    sentAt:   now,
  });

  await updateThread(orgId, thread.id, { lastMessageAt: now });

  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "email_processed",
    metadata: {
      threadId: thread.id,
      source:   "manual_test",
      from:     parsed.data.fromEmail,
    },
  });

  // Auto-trigger AI draft, exactly like the inbound webhook does. This makes
  // test threads behave like real ones — the agent lands on the thread page
  // and a draft is already waiting for review.
  const triageResult = await autoTriageNewMessage({
    organizationId: orgId,
    threadId:       thread.id,
    newEmailBody:   parsed.data.body,
  });

  return NextResponse.json({
    thread,
    draftId: triageResult.ok ? triageResult.draftId : null,
    triage:  triageResult.ok ? "generated" : `skipped: ${triageResult.reason}`,
  });
}
