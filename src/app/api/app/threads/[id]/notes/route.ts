/**
 * /api/app/threads/[id]/notes
 *
 * GET  — list notes for a thread (newest first)
 * POST — append a new note authored by the current user
 *
 * Org-scoped via the thread.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listNotes, createNote } from "@/lib/app/notes";
import { writeAuditLog } from "@/lib/app/audit";

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
  const notes = await listNotes(account.organization.id, threadId);
  return NextResponse.json({ notes });
}

const Body = z.object({
  bodyText: z.string().trim().min(1).max(10_000),
});

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
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const { id: threadId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const note = await createNote({
    organizationId: account.organization.id,
    threadId,
    userId:         account.user.id,
    bodyText:       parsed.data.bodyText,
  });

  if (!note) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "ai_draft_edited", // closest existing — we don't have a "note_added" action
    metadata:       { threadId, noteId: note.id, type: "internal_note" },
  });

  return NextResponse.json({ note });
}
