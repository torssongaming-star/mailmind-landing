/**
 * /api/app/blocklist
 * GET  — list blocklist entries
 * POST — add an entry
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listBlocklist, addBlockEntry } from "@/lib/app/blocklist";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const entries = await listBlocklist(account.organization.id);
  return NextResponse.json({ entries });
}

const PostBody = z.object({
  pattern: z.string().trim().min(1).max(320),
  reason:  z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltig förfrågan", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const entry = await addBlockEntry(account.organization.id, parsed.data.pattern, parsed.data.reason);
    return NextResponse.json({ entry });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "Mönstret finns redan i blocklistan" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
