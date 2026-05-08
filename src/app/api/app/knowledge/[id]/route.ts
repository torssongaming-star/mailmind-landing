/**
 * PATCH /api/app/knowledge/:id — update entry
 * DELETE /api/app/knowledge/:id — delete entry
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { updateKnowledgeEntry, deleteKnowledgeEntry } from "@/lib/app/knowledge";

const PatchBody = z.object({
  question: z.string().min(1).max(500).optional(),
  answer:   z.string().min(1).max(2000).optional(),
  category: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getCurrentAccount(userId);
  if (!account.user) return NextResponse.json({ error: "Not provisioned" }, { status: 403 });

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await updateKnowledgeEntry(account.organization.id, id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getCurrentAccount(userId);
  if (!account.user) return NextResponse.json({ error: "Not provisioned" }, { status: 403 });

  const { id } = await params;
  await deleteKnowledgeEntry(account.organization.id, id);
  return NextResponse.json({ ok: true });
}
