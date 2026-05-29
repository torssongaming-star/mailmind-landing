/**
 * POST /api/quoting/construction/draft
 *
 * AI-draft mode for construction quotes. Mirrors the solar draft route:
 * fetches customer-facing KB (construction + universal), injects construction
 * prompt fragments, calls draftQuote(), runs the egress gate, returns the
 * AiDraftResult with an egress_blocked flag if the gate fires.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { getQuote } from "@/lib/quoting-common/data/quotes";
import { listCustomerFacingEntries, listKbEntries } from "@/lib/quoting-common/data/kb";
import { draftQuote } from "@/lib/quoting-common/ai/author";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import { getConstructionPromptFragments } from "@/lib/construction/ai-prompts/construction";

export const runtime = "nodejs";

const DraftBody = z.object({
  quoteId:      z.string().min(1),
  customerName: z.string().trim().min(1).max(200),
  scopeBrief:   z.string().trim().min(10).max(2000),
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
  if (!hasProductAccess(account, "construction")) {
    return NextResponse.json({ error: "Construction product not enabled" }, { status: 403 });
  }

  const parsed = DraftBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { quoteId, customerName, scopeBrief } = parsed.data;
  const orgId = account.organization.id;

  const quote = await getQuote(orgId, quoteId);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const kbEntries       = await listCustomerFacingEntries(orgId);
  const internalEntries = await listKbEntries(orgId, { visibility: "internal_only" });

  const draft = await draftQuote({
    orgId,
    quoteId,
    vertical:        "construction",
    customerName,
    scopeBrief,
    kbEntries,
    promptFragments: getConstructionPromptFragments(),
  });

  const egress = runEgressGate({ renderedText: draft.narrativeText }, internalEntries);
  const riskFlags = [...draft.riskFlags];
  if (!egress.ok) {
    riskFlags.push("egress_blocked", ...egress.blockedReasons);
  }

  return NextResponse.json({ draft: { ...draft, riskFlags } }, { status: 200 });
}
