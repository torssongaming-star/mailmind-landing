/**
 * /api/app/webhooks
 * GET  — list webhook endpoints
 * POST — create a new endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, assertCanUseWebhooks } from "@/lib/app/entitlements";
import { requireOrgAdmin } from "@/lib/app/rbac";
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
  // https only — webhook delivery refuses http anyway, fail at validation
  // so the user gets a clear message instead of a silent permanent reject.
  url:          z.string().url().max(2048).refine(
    (u) => u.startsWith("https://"),
    { message: "Webhook URL måste börja med https://" },
  ),
  caseTypeSlug: z.string().max(100).default("*"),
  secret:       z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Plan gate: webhooks require Business+ tier
  const gate = await assertCanUseWebhooks(userId);
  if (!gate.ok) {
    if (gate.reason === "plan_required") {
      return NextResponse.json(
        {
          error:    "Webhooks ingår i Business-planen och uppåt. Uppgradera för att aktivera API-integrationer.",
          upgrade:  true,
          requires: "business",
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Forbidden", reason: gate.reason }, { status: 403 });
  }
  const { account } = gate;
  const guard = requireOrgAdmin(account);
  if (guard) return NextResponse.json(guard.body, { status: guard.status });

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
