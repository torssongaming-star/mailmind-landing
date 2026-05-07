/**
 * /api/app/organization
 *
 * GET — current org metadata (name, etc.)
 * PUT — update fields the customer can edit (name only for now)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, isDbConnected, organizations } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  return NextResponse.json({
    organization: {
      id:   account.organization.id,
      name: account.organization.name,
    },
  });
}

const PutBody = z.object({
  name: z.string().trim().min(1).max(255),
});

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  // Only owners and admins can rename the workspace
  if (account.user.role !== "owner" && account.user.role !== "admin") {
    return NextResponse.json({ error: "Only owners or admins can edit the workspace" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isDbConnected()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await db
    .update(organizations)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(organizations.id, account.organization.id));

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "onboarding_completed", // closest existing audit type for "config change"
    metadata:       { event: "organization_renamed", newName: parsed.data.name },
  });

  return NextResponse.json({ ok: true });
}
