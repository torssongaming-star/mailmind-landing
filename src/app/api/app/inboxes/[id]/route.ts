/**
 * DELETE /api/app/inboxes/:id — remove an inbox.
 *
 * Cascades to threads via FK (ON DELETE CASCADE on email_threads.inbox_id is
 * set, but messages/drafts cascade through threads).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { deleteInbox } from "@/lib/app/threads";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  await deleteInbox(account.organization.id, id);
  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "inbox_disconnected",
    metadata:       { inboxId: id },
  });

  return NextResponse.json({ ok: true });
}
