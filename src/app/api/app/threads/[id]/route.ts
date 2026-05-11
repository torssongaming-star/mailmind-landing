/**
 * GET  /api/app/threads/:id  — single thread + messages + drafts
 * PATCH /api/app/threads/:id — partial update (currently: tags only)
 *
 * Both routes are org-scoped via auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getThread, listMessages, listDraftsForThread, updateThread } from "@/lib/app/threads";

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

const PatchBody = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

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
    return NextResponse.json({ error: "App access blocked" }, { status: 403 });
  }

  const { id: threadId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const thread = await getThread(account.organization.id, threadId);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Parameters<typeof updateThread>[2] = {};
  if (parsed.data.tags !== undefined) {
    // Deduplicate + lowercase
    patch.tags = [...new Set(parsed.data.tags.map(t => t.toLowerCase()))];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await updateThread(account.organization.id, threadId, patch);
  return NextResponse.json({ ok: true, ...patch });
}
