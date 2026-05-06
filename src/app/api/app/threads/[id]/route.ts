/**
 * GET /api/app/threads/:id
 *
 * Returns one thread + its messages + AI drafts. Org-scoped via auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getThread, listMessages, listDraftsForThread } from "@/lib/app/threads";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id: threadId } = await params;

  const thread = await getThread(account.organization.id, threadId);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [messages, drafts] = await Promise.all([
    listMessages(threadId),
    listDraftsForThread(threadId),
  ]);

  return NextResponse.json({ thread, messages, drafts });
}
