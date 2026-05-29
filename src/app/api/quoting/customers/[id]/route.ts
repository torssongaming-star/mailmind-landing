/**
 * GET   /api/quoting/customers/[id]  — fetch one customer (member+)
 * PATCH /api/quoting/customers/[id]  — update customer (member+)
 *
 * No DELETE: customers are referenced by quotes (FK). Deletion is intentionally
 * omitted from the MVP to avoid orphaning quotes; archive/merge is future work.
 *
 * Lifecycle: auth → account → app-access → zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getCustomer, updateCustomer } from "@/lib/quoting-common/data/customers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  name:      z.string().trim().min(1).max(200).optional(),
  orgNumber: z.string().trim().max(20).nullish(),
  email:     z.string().email().nullish(),
  phone:     z.string().trim().max(40).nullish(),
  address:   z.object({
    street:     z.string().optional(),
    city:       z.string().optional(),
    postalCode: z.string().optional(),
    country:    z.string().optional(),
  }).nullish(),
});

async function requireAuth(userId: string) {
  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) return { error: "Account not provisioned", status: 400 } as const;
  if (!account.access.canUseApp) return { error: "App access blocked", status: 403 } as const;
  return { account };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireAuth(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const customer = await getCustomer(check.account.organization!.id, id);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ customer });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireAuth(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const updated = await updateCustomer(check.account.organization!.id, id, {
    ...(parsed.data.name      !== undefined && { name:      parsed.data.name }),
    ...(parsed.data.orgNumber !== undefined && { orgNumber: parsed.data.orgNumber ?? undefined }),
    ...(parsed.data.email     !== undefined && { email:     parsed.data.email ?? undefined }),
    ...(parsed.data.phone     !== undefined && { phone:     parsed.data.phone ?? undefined }),
    ...(parsed.data.address   !== undefined && { address:   parsed.data.address ?? undefined }),
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ customer: updated });
}
