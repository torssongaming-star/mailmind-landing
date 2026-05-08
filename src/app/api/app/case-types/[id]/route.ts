/**
 * /api/app/case-types/:id
 *
 * PATCH  — update a case type (label, required fields, route, etc.)
 * DELETE — remove a case type
 *
 * Org-scoped: every read/write checks organizationId matches the user's.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, isDbConnected, caseTypes } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";

export const runtime = "nodejs";

const PatchBody = z.object({
  label:          z.string().trim().min(1).max(255).optional(),
  requiredFields: z.array(z.string().trim().min(1)).max(20).optional(),
  routeToEmail:   z.string().email().nullable().optional(),
  isDefault:      z.boolean().optional(),
  sortOrder:      z.number().int().min(0).max(999).optional(),
  slaHours:       z.number().int().min(1).max(720).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isDbConnected()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await db
    .update(caseTypes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(
      eq(caseTypes.id, id),
      eq(caseTypes.organizationId, account.organization.id),
    ));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  if (!isDbConnected()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await db
    .delete(caseTypes)
    .where(and(
      eq(caseTypes.id, id),
      eq(caseTypes.organizationId, account.organization.id),
    ));

  return NextResponse.json({ ok: true });
}
