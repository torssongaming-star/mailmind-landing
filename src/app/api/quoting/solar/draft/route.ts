/**
 * POST /api/quoting/solar/draft
 *
 * AI-draft mode for solar quotes. Accepts a salesperson brief, fetches
 * customer-facing KB entries for the org (solar + universal), injects solar
 * prompt fragments, calls draftQuote(), then runs the egress gate on the
 * returned narrative before sending it to the client.
 *
 * Flow:
 *   auth → account → product-access('solar') → validate body →
 *   quote existence check → listCustomerFacingEntries →
 *   draftQuote() → runEgressGate → return AiDraftResult
 *
 * Notes:
 *   - Never throws to the client — errors surface via riskFlags.
 *   - The egress gate adds 'egress_blocked' to riskFlags if the narrative
 *     contains internal data or unfilled placeholders. The narrative is still
 *     returned so the salesperson can fix it manually.
 *   - proposedInputs are NOT validated against SolarEngineInputSchema here;
 *     that happens if/when the salesperson runs /calculate.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { getQuote } from "@/lib/quoting-common/data/quotes";
import { listCustomerFacingEntries, listKbEntries } from "@/lib/quoting-common/data/kb";
import { draftQuote } from "@/lib/quoting-common/ai/author";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import { getSolarPromptFragments } from "@/lib/solar/ai-prompts/solar";

export const runtime = "nodejs";

const DraftBody = z.object({
  quoteId:      z.string().min(1),
  customerName: z.string().trim().min(1).max(200),
  scopeBrief:   z.string().trim().min(10).max(2000),
});

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }
  if (!hasProductAccess(account, "solar")) {
    return NextResponse.json({ error: "Solar product not enabled" }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const parsed = DraftBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { quoteId, customerName, scopeBrief } = parsed.data;
  const orgId = account.organization.id;

  // ── Quote existence check ─────────────────────────────────────────────────
  const quote = await getQuote(orgId, quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // ── Fetch KB entries (audience-classified before AI layer) ────────────────
  // customer_facing entries only — solar-scoped + universal (vertical=null)
  // The listCustomerFacingEntries function fetches only customer_facing entries.
  // We fetch without a vertical filter so we get both solar and universal entries.
  const kbEntries = await listCustomerFacingEntries(orgId);

  // Internal-only entries needed for the egress gate's data-leak scan
  const internalEntries = await listKbEntries(orgId, { visibility: "internal_only" });

  // ── Call AI authoring layer ───────────────────────────────────────────────
  const draft = await draftQuote({
    orgId,
    quoteId,
    vertical:        "solar",
    customerName,
    scopeBrief,
    kbEntries,
    promptFragments: getSolarPromptFragments(),
  });

  // ── Egress gate ───────────────────────────────────────────────────────────
  const egress = runEgressGate(
    { renderedText: draft.narrativeText },
    internalEntries,
  );

  const riskFlags = [...draft.riskFlags];
  if (!egress.ok) {
    riskFlags.push("egress_blocked", ...egress.blockedReasons);
  }

  return NextResponse.json(
    {
      draft: {
        ...draft,
        riskFlags,
      },
    },
    { status: 200 },
  );
}
