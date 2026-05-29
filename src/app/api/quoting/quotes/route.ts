/**
 * GET  /api/quoting/quotes?vertical=solar&status=draft  — list quotes
 * POST /api/quoting/quotes                              — create quote
 *
 * Lifecycle: auth → account → app-access → product-access → zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listQuotes, createQuote } from "@/lib/quoting-common/data/quotes";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";

export const runtime = "nodejs";

const QUOTE_STATUSES: QuoteStatus[] = [
  "draft", "calculating", "ready", "sent", "viewed",
  "accepted", "signed", "rejected", "expired",
];

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const vertical = req.nextUrl.searchParams.get("vertical") ?? undefined;
  const statusRaw = req.nextUrl.searchParams.get("status");
  const status = QUOTE_STATUSES.includes(statusRaw as QuoteStatus)
    ? (statusRaw as QuoteStatus)
    : undefined;

  if (vertical && !hasProductAccess(account, vertical)) {
    return NextResponse.json({ error: "Product not enabled", reason: "product_required" }, { status: 403 });
  }

  const quotes = await listQuotes(account.organization.id, { vertical, status });
  return NextResponse.json({ quotes });
}

// ── POST ──────────────────────────────────────────────────────────────────────

const PostBody = z.object({
  vertical:            z.string().min(1).max(50),
  customerId:          z.string().uuid().optional(),
  priceBookVersionId:  z.string().uuid().optional(),
  validUntil:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  meta:                z.record(z.string(), z.unknown()).optional(),
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

  const body = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input", issues: body.error.issues }, { status: 400 });
  }

  if (!hasProductAccess(account, body.data.vertical)) {
    return NextResponse.json({ error: "Product not enabled", reason: "product_required" }, { status: 403 });
  }

  const quote = await createQuote(
    account.organization.id,
    {
      vertical:           body.data.vertical,
      customerId:         body.data.customerId,
      priceBookVersionId: body.data.priceBookVersionId,
      validUntil:         body.data.validUntil,
      meta:               body.data.meta,
    },
    account.user.id,
  );

  return NextResponse.json({ quote }, { status: 201 });
}
