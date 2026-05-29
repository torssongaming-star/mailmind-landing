/**
 * GET    /api/quoting/quotes/[id]  — quote detail + lines + workflow
 * PATCH  /api/quoting/quotes/[id]  — update quote (validates status transitions)
 * DELETE /api/quoting/quotes/[id]  — soft-delete (status → rejected)
 *
 * Lifecycle: auth → account → app-access → product-access → zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { getQuote, updateQuote, softDeleteQuote, listQuoteLines, listWorkflowEvents } from "@/lib/quoting-common/data/quotes";
import { canTransition } from "@/lib/quoting-common/domain/quote-state";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const quote = await getQuote(account.organization.id, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasProductAccess(account, quote.vertical)) {
    return NextResponse.json({ error: "Product not enabled", reason: "product_required" }, { status: 403 });
  }

  const [lines, events] = await Promise.all([
    listQuoteLines(account.organization.id, id),
    listWorkflowEvents(account.organization.id, id),
  ]);

  return NextResponse.json({ quote, lines, events });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const PatchBody = z.object({
  customerId:         z.string().uuid().nullish(),
  status:             z.enum(["draft","calculating","ready","sent","viewed","accepted","signed","rejected","expired"]).optional(),
  priceBookVersionId: z.string().uuid().nullish(),
  currency:           z.string().length(3).optional(),
  subtotal:           z.string().optional(),
  vatAmount:          z.string().optional(),
  rotDeduction:       z.string().optional(),
  rutDeduction:       z.string().optional(),
  total:              z.string().optional(),
  validUntil:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  assignedUserId:     z.string().uuid().nullish(),
  meta:               z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const body = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input", issues: body.error.issues }, { status: 400 });
  }

  const existing = await getQuote(account.organization.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasProductAccess(account, existing.vertical)) {
    return NextResponse.json({ error: "Product not enabled", reason: "product_required" }, { status: 403 });
  }

  // Validate status transition
  if (body.data.status && body.data.status !== existing.status) {
    if (!canTransition(existing.status as QuoteStatus, body.data.status as QuoteStatus)) {
      return NextResponse.json(
        {
          error: "Invalid status transition",
          reason: "invalid_transition",
          from: existing.status,
          to: body.data.status,
        },
        { status: 422 },
      );
    }
  }

  const updated = await updateQuote(
    account.organization.id,
    id,
    body.data,
    account.user.id,
  );

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ quote: updated });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const existing = await getQuote(account.organization.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasProductAccess(account, existing.vertical)) {
    return NextResponse.json({ error: "Product not enabled", reason: "product_required" }, { status: 403 });
  }

  await softDeleteQuote(account.organization.id, id, account.user.id);
  return new NextResponse(null, { status: 204 });
}
