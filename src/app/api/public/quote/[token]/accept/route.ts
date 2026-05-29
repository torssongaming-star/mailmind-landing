/**
 * POST /api/public/quote/[token]/accept
 *
 * Public, unauthenticated endpoint. The signed share token IS the
 * authorisation — possession of a valid token for quote X lets the holder
 * accept quote X. No Clerk session.
 *
 * Walks the quote through the state machine to `signed`:
 *   sent → viewed → accepted → signed
 * (only the valid edges from the current status are taken). The signer's name
 * and timestamp are recorded in quote.meta.signature.
 *
 * Idempotent-ish: an already-signed quote returns ok without re-signing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { verifyShareToken } from "@/lib/quoting-common/sharing/token";
import {
  getQuote,
  updateQuote,
  appendWorkflowEvent,
} from "@/lib/quoting-common/data/quotes";
import { listCustomerFacingEntries } from "@/lib/quoting-common/data/kb";
import { canTransition } from "@/lib/quoting-common/domain/quote-state";
import { rateLimit } from "@/lib/rate-limit";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

const Body = z.object({
  signerName: z.string().trim().min(1).max(200),
});

// Ordered path to the signed terminal state.
const PATH: QuoteStatus[] = ["viewed", "accepted", "signed"];

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { token } = await params;

  // Rate limit unauthenticated traffic per-IP — 10 attempts / minute.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await rateLimit(`quote-accept:${ip}`, { capacity: 10, refillPerSec: 10 / 60 }))) {
    return NextResponse.json({ error: "För många försök. Försök igen om en stund." }, { status: 429 });
  }

  const claims = verifyShareToken(token);
  if (!claims) return NextResponse.json({ error: "Ogiltig länk" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ange ditt namn för att signera." }, { status: 400 });
  }

  const { orgId, quoteId } = claims;
  const quote = await getQuote(orgId, quoteId);
  if (!quote) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });

  const status = quote.status as QuoteStatus;

  // Already signed → success (idempotent)
  if (status === "signed") {
    return NextResponse.json({ ok: true, status: "signed" });
  }

  // Refuse terminal-but-not-signed states
  if (status === "expired" || status === "rejected") {
    return NextResponse.json(
      { error: "Offerten är inte längre aktiv.", reason: status },
      { status: 422 },
    );
  }

  // Walk forward through the valid path, starting just past the current status.
  // e.g. status=sent → take viewed, accepted, signed; status=viewed → accepted, signed.
  let current: QuoteStatus = status;
  const startIdx = current === "sent" ? 0 : PATH.indexOf(current) + 1;
  if (startIdx < 0) {
    return NextResponse.json({ error: "Offerten kan inte signeras." }, { status: 422 });
  }

  for (let i = startIdx; i < PATH.length; i++) {
    const next = PATH[i];
    if (!canTransition(current, next)) {
      return NextResponse.json(
        { error: "Offerten kan inte signeras från sitt nuvarande läge." },
        { status: 422 },
      );
    }
    await updateQuote(orgId, quoteId, { status: next });
    await appendWorkflowEvent(orgId, quoteId, {
      fromStage: current,
      toStage:   next,
      reason:    next === "signed" ? `Signerad av ${parsed.data.signerName}` : "Kundåtgärd via offertlänk",
    });
    current = next;
  }

  // Snapshot the exact customer-visible content the signer agreed to, and hash
  // it for tamper-evident proof. We hash the same material the public view
  // renders: narrative + persisted ROI summary + customer-facing KB bodies.
  const cfEntries = await listCustomerFacingEntries(orgId, quote.vertical);
  const narrative = typeof quote.meta?.narrativeText === "string" ? quote.meta.narrativeText : "";
  const roiSummary = Array.isArray(quote.meta?.roiSummary) ? quote.meta.roiSummary : [];
  const snapshot = JSON.stringify({ narrative, roiSummary, kb: cfEntries.map((e) => ({ id: e.id, title: e.title, body: e.body })) });
  const contentHash = createHash("sha256").update(snapshot).digest("hex");

  // Record signature metadata
  await updateQuote(orgId, quoteId, {
    meta: {
      ...(quote.meta ?? {}),
      signature: {
        signerName:  parsed.data.signerName,
        signedAt:    new Date().toISOString(),
        method:      "share_link",
        ip,
        contentHash,
      },
    },
  });

  return NextResponse.json({ ok: true, status: "signed" });
}
