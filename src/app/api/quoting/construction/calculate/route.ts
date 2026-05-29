/**
 * POST /api/quoting/construction/calculate
 *
 * Runs the construction estimate engine for a quote and persists the result.
 *
 * Unlike Solar (which has a dedicated solar_roi_scenarios audit table), the
 * construction estimate is stored on quote.meta (estimate + a vertical-agnostic
 * roiSummary the public /q view can render). This avoids a DB migration for the
 * MVP; a dedicated append-only scenarios table is future work if an audit trail
 * is needed.
 *
 * Lifecycle: auth → account → product-access('construction') → Zod → quote
 *            existence + terminal guard → engine → persist meta
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { ConstructionEstimateInputSchema } from "@/lib/construction/engine/types";
import { runConstructionEstimate } from "@/lib/construction/engine/estimate";
import { saveEstimateScenario } from "@/lib/construction/data/scenarios";
import { getQuote, updateQuote } from "@/lib/quoting-common/data/quotes";
import { isTerminal } from "@/lib/quoting-common/domain/quote-state";

export const runtime = "nodejs";

function fmt(n: number, d = 0): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d });
}
const sek = (n: number) => `${fmt(Math.round(n))} kr`;

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

  const rawBody = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { quoteId, ...engineInputRaw } = rawBody as Record<string, unknown>;
  if (typeof quoteId !== "string" || !quoteId) {
    return NextResponse.json({ error: "quoteId is required" }, { status: 400 });
  }

  const parsed = ConstructionEstimateInputSchema.safeParse(engineInputRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid engine input", issues: parsed.error.issues }, { status: 400 });
  }

  const orgId = account.organization.id;
  const quote = await getQuote(orgId, quoteId);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (isTerminal(quote.status)) {
    return NextResponse.json(
      { error: "Cannot recalculate a quote in a terminal state", status: quote.status },
      { status: 422 },
    );
  }

  const result = runConstructionEstimate(parsed.data);

  // Append a frozen, versioned scenario (audit trail — mirrors solar).
  // Best-effort: the construction_estimate_scenarios table requires a migration;
  // until it exists we must not break the calculation. The estimate is also
  // persisted on quote.meta below, so the result is never lost.
  try {
    await saveEstimateScenario(orgId, quoteId, result.engineVersion, parsed.data, result);
  } catch (err) {
    console.error("[construction/calculate] scenario persist skipped:", err instanceof Error ? err.message : err);
  }

  // Vertical-agnostic display figures for the public /q view + document.
  const roiSummary = [
    { label: "Material", value: sek(result.materialCostSek) },
    { label: "Arbete", value: sek(result.labourCostSek) },
    { label: "Moms (25 %)", value: sek(result.vatSek) },
    { label: "ROT-avdrag", value: sek(result.rotDeductionSek) },
    { label: "Att betala", value: sek(result.totalSek) },
  ];

  await updateQuote(
    orgId,
    quoteId,
    {
      meta: { ...(quote.meta ?? {}), estimate: result, estimateInputs: parsed.data, roiSummary },
      total: String(result.totalSek),
    },
    account.user.id,
  );

  return NextResponse.json({ result }, { status: 200 });
}
