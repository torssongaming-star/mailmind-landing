/**
 * GET  /api/app/knowledge  — list all entries for the org
 * POST /api/app/knowledge  — create a new entry
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listKnowledge, createKnowledgeEntry } from "@/lib/app/knowledge";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getCurrentAccount(userId);
  if (!account.user) return NextResponse.json({ error: "Not provisioned" }, { status: 403 });

  const entries = await listKnowledge(account.organization.id);
  return NextResponse.json({ entries });
}

const CreateBody = z.object({
  question: z.string().min(1).max(500),
  answer:   z.string().min(1).max(2000),
  category: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getCurrentAccount(userId);
  if (!account.user) return NextResponse.json({ error: "Not provisioned" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const entry = await createKnowledgeEntry({
    organizationId: account.organization.id,
    ...parsed.data,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
