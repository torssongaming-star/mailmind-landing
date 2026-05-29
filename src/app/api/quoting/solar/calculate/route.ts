/**
 * POST /api/quoting/solar/calculate
 *
 * Runs the Solar ROI engine for a quote, persists the result as a versioned
 * scenario, and returns the full SolarEngineResult.
 *
 * Lifecycle: auth → account → product-access('solar') → Zod → engine → persist
 *
 * The quote must exist and belong to the same org; its status must allow a
 * new calculation (not in a terminal state).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { SolarEngineInputSchema } from "@/lib/solar/engine/types";
import { runSolarRoi } from "@/lib/solar/engine/roi";
import { saveScenario } from "@/lib/solar/data/scenarios";
import { getQuote } from "@/lib/quoting-common/data/quotes";
import { isTerminal } from "@/lib/quoting-common/domain/quote-state";

export const runtime = "nodejs";

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
  const rawBody = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { quoteId, ...engineInputRaw } = rawBody as Record<string, unknown>;
  if (typeof quoteId !== "string" || !quoteId) {
    return NextResponse.json({ error: "quoteId is required" }, { status: 400 });
  }

  // ── Validate engine input ─────────────────────────────────────────────────
  const parsed = SolarEngineInputSchema.safeParse(engineInputRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid engine input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // ── Quote existence + terminal-state guard ────────────────────────────────
  const orgId = account.organization.id;
  const quote = await getQuote(orgId, quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  if (isTerminal(quote.status)) {
    return NextResponse.json(
      { error: "Cannot recalculate a quote in a terminal state", status: quote.status },
      { status: 422 },
    );
  }

  // ── Run engine ────────────────────────────────────────────────────────────
  const result = runSolarRoi(parsed.data);

  // ── Persist scenario ──────────────────────────────────────────────────────
  const scenario = await saveScenario(
    orgId,
    quoteId,
    result.engineVersion,
    parsed.data,
    result,
  );

  return NextResponse.json({ scenarioId: scenario.id, result }, { status: 200 });
}
