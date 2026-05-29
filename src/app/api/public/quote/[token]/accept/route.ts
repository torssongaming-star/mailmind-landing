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
import { z } from "zod";
import { verifyShareToken } from "@/lib/quoting-common/sharing/token";
import {
  getQuoteByIdUnscoped,
  updateQuote,
  appendWorkflowEvent,
} from "@/lib/quoting-common/data/quotes";
import { canTransition } from "@/lib/quoting-common/domain/quote-state";
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

  const quoteId = verifyShareToken(token);
  if (!quoteId) return NextResponse.json({ error: "Ogiltig länk" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ange ditt namn för att signera." }, { status: 400 });
  }

  const quote = await getQuoteByIdUnscoped(quoteId);
  if (!quote) return NextResponse.json({ error: "Offerten hittades inte" }, { status: 404 });

  const orgId = quote.organizationId;
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

  // Record signature metadata
  await updateQuote(orgId, quoteId, {
    meta: {
      ...(quote.meta ?? {}),
      signature: {
        signerName: parsed.data.signerName,
        signedAt:   new Date().toISOString(),
        method:     "share_link",
      },
    },
  });

  return NextResponse.json({ ok: true, status: "signed" });
}
