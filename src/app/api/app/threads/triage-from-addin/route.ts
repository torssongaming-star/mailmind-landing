/**
 * POST /api/app/threads/triage-from-addin
 *
 * Called by the Outlook add-in taskpane.
 * Reads the current email (subject, from, body) from the request,
 * creates a thread + auto-triage draft, and returns a summary for
 * the taskpane to display.
 *
 * Auth: Clerk session (cookie-based, same as all /api/app/* routes).
 * Org: resolved server-side via getCurrentAccount — never trust client.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { createThread, appendMessage, updateThread, getDraft } from "@/lib/app/threads";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const Body = z.object({
  subject: z.string().trim().min(1).max(500),
  from:    z.string().email({ message: "Ogiltig avsändaradress." }),
  body:    z.string().trim().min(1).max(50_000),
});

export async function POST(req: NextRequest) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Resolve org + entitlements (never trust client-supplied org id)
  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json(
      { error: "App access blocked", reason: account.access.reason },
      { status: 403 },
    );
  }

  // 3. Parse + validate body
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, from, body } = parsed.data;
  const orgId = account.organization.id;
  const now = new Date();

  // 4. Create thread
  const thread = await createThread({
    organizationId: orgId,
    fromEmail:      from,
    subject,
  });

  if (!thread) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  // 5. Append customer message
  await appendMessage({
    threadId: thread.id,
    role:     "customer",
    bodyText: body,
    sentAt:   now,
  });

  await updateThread(orgId, thread.id, { lastMessageAt: now });

  // 6. Audit
  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "email_processed",
    metadata: {
      threadId: thread.id,
      source:   "outlook_addin",
      from,
    },
  });

  // 7. Auto-triage (generates AI draft)
  const triageResult = await autoTriageNewMessage({
    organizationId: orgId,
    threadId:       thread.id,
    newEmailBody:   body,
  });

  // 8. Fetch draft for preview + metadata (classification, confidence)
  const draftId = triageResult.ok ? (triageResult.draftId ?? null) : null;
  let draftPreview: string | null = null;
  let classification: string | null = null;
  let confidence: number | null = null;

  if (draftId) {
    const draft = await getDraft(orgId, draftId);
    if (draft) {
      draftPreview = draft.bodyText
        ? draft.bodyText.slice(0, 400) + (draft.bodyText.length > 400 ? "…" : "")
        : null;
      const meta = draft.metadata as Record<string, unknown> | null;
      classification = (meta?.classification as string) ?? null;
      confidence     = (meta?.confidence as number)     ?? null;
    }
  }

  return NextResponse.json({
    threadId: thread.id,
    subject:  thread.subject,
    classification,
    draftId,
    draftPreview,
    confidence,
  });
}
