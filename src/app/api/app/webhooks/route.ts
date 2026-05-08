/**
 * /api/app/webhooks
 * GET  — list webhook endpoints
 * POST — create a new endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listWebhooks, createWebhook } from "@/lib/app/webhooks";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const webhooks = await listWebhooks(account.organization.id);
  return NextResponse.json({ webhooks });
}

const PostBody = z.object({
  url:          z.string().url().max(2048),
  caseTypeSlug: z.string().max(100).default("*"),
  secret:       z.string().max(255).optional(),
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

  const webhook = await createWebhook(account.organization.id, {
    url:          parsed.data.url,
    caseTypeSlug: parsed.data.caseTypeSlug,
    secret:       parsed.data.secret,
  });

  return NextResponse.json({ webhook });
}
