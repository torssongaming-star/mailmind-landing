/**
 * POST /api/app/threads/bulk
 *
 * Apply an action to multiple threads at once. Used by the inbox UI to
 * resolve/escalate/delete several rows in one call.
 *
 * Body: { threadIds: string[], action: "resolve" | "escalate" | "delete" }
 *
 * All updates are org-scoped. Threads belonging to a different org are silently
 * skipped (rather than 403'd) so a single bad ID can't fail the whole batch.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db, isDbConnected, emailThreads } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const Body = z.object({
  threadIds: z.array(z.string().uuid()).min(1).max(200),
  action:    z.enum(["resolve", "escalate", "delete"]),
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
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  if (!isDbConnected()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const orgId = account.organization.id;
  const { threadIds, action } = parsed.data;

  const now = new Date();
  let affected = 0;

  if (action === "delete") {
    const result = await db
      .delete(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, orgId),
        inArray(emailThreads.id, threadIds),
      ))
      .returning({ id: emailThreads.id });
    affected = result.length;
  } else {
    const newStatus = action === "resolve" ? "resolved" : "escalated";
    const result = await db
      .update(emailThreads)
      .set({ status: newStatus, updatedAt: now })
      .where(and(
        eq(emailThreads.organizationId, orgId),
        inArray(emailThreads.id, threadIds),
      ))
      .returning({ id: emailThreads.id });
    affected = result.length;
  }

  // One audit row for the whole batch (cheaper + easier to reason about than
  // N rows for N threads).
  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         action === "resolve" ? "thread_resolved"
                  : action === "escalate" ? "thread_escalated"
                  : "ai_draft_rejected", // closest existing action for "deleted threads"
    metadata:       { bulk: true, requested: threadIds.length, affected, action },
  });

  return NextResponse.json({ ok: true, affected, requested: threadIds.length });
}
