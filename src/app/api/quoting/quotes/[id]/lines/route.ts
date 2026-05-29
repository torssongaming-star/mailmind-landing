/**
 * GET /api/quoting/quotes/[id]/lines  — list quote lines
 * PUT /api/quoting/quotes/[id]/lines  — replace all lines + recompute totals
 *
 * PUT is the single mutation: it replaces the full line set (upsertQuoteLines)
 * and recomputes the quote's subtotal / VAT / total from the lines, persisting
 * them on the quote. Keeps the quote header and its lines consistent in one
 * call. Blocked on terminal quotes.
 *
 * Lifecycle: auth → account → app-access → product-access → zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { getQuote, listQuoteLines, upsertQuoteLines, updateQuote } from "@/lib/quoting-common/data/quotes";
import { isTerminal } from "@/lib/quoting-common/domain/quote-state";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const LineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  qty:         z.number().finite().min(0),
  unitPrice:   z.number().finite(),
  productId:   z.string().uuid().optional(),
});

const PutBody = z.object({
  lines:   z.array(LineSchema).max(200),
  vatRate: z.number().min(0).max(0.5).default(0.25),
});

async function resolve(userId: string, quoteId: string) {
  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) return { error: "Account not provisioned", status: 400 as const };
  if (!account.access.canUseApp) return { error: "App access blocked", status: 403 as const };
  const quote = await getQuote(account.organization.id, quoteId);
  if (!quote) return { error: "Quote not found", status: 404 as const };
  if (!hasProductAccess(account, quote.vertical)) return { error: "Product not enabled", status: 403 as const };
  return { account, quote };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await resolve(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const lines = await listQuoteLines(r.account.organization!.id, id);
  return NextResponse.json({ lines });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await resolve(userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  if (isTerminal(r.quote.status)) {
    return NextResponse.json({ error: "Offerten är låst i ett slutläge.", status: r.quote.status }, { status: 422 });
  }

  const parsed = PutBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const orgId = r.account.organization!.id;
  const lines = await upsertQuoteLines(orgId, id, parsed.data.lines.map((l, i) => ({ ...l, sortOrder: i })));

  // Recompute header totals from the persisted lines.
  const subtotal = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
  const vatAmount = Math.round(subtotal * parsed.data.vatRate * 100) / 100;
  const total = subtotal + vatAmount;

  const quote = await updateQuote(
    orgId,
    id,
    { subtotal: String(subtotal), vatAmount: String(vatAmount), total: String(total) },
    r.account.user!.id,
  );

  return NextResponse.json({ lines, quote });
}
