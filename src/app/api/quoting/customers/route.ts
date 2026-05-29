/**
 * GET  /api/quoting/customers?vertical=solar  — list customers
 * POST /api/quoting/customers                 — create customer
 *
 * Lifecycle: auth → account → app-access → product-access → zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import {
  listCustomers,
  createCustomer,
} from "@/lib/quoting-common/data/customers";

export const runtime = "nodejs";

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

  // Product gate — at least one quoting vertical must be active
  const vertical = req.nextUrl.searchParams.get("vertical") ?? "";
  if (vertical && !hasProductAccess(account, vertical)) {
    return NextResponse.json({ error: "Product not enabled", reason: "product_required" }, { status: 403 });
  }

  const customers = await listCustomers(account.organization.id);
  return NextResponse.json({ customers });
}

// ── POST ──────────────────────────────────────────────────────────────────────

const PostBody = z.object({
  vertical:   z.string().min(1),
  name:       z.string().trim().min(1).max(200),
  orgNumber:  z.string().trim().max(20).optional(),
  email:      z.string().email().optional(),
  phone:      z.string().trim().max(40).optional(),
  address:    z.object({
    street:     z.string().optional(),
    city:       z.string().optional(),
    postalCode: z.string().optional(),
    country:    z.string().optional(),
  }).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
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

  const customer = await createCustomer(account.organization.id, {
    name:      body.data.name,
    orgNumber: body.data.orgNumber,
    email:     body.data.email,
    phone:     body.data.phone,
    address:   body.data.address,
    meta:      body.data.meta,
  });

  return NextResponse.json({ customer }, { status: 201 });
}
