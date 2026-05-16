/**
 * POST   /api/app/account/delete  — request account deletion (owner only)
 * DELETE /api/app/account/delete  — cancel a pending deletion request
 *
 * Flow:
 *   1. Owner POSTs → org.deletionRequestedAt = now
 *   2. App enters read-only-ish state (entitlements.computeAccess can gate)
 *   3. After 30 days, cron purges everything (cascade from organizations row)
 *   4. Within 30 days, owner can DELETE to cancel (clears deletionRequestedAt)
 *
 * We never delete the Clerk user — that's handled by Clerk's UserProfile UI.
 * We only delete our DB-side data; the Clerk account remains so the user can
 * log in to a different org or recover.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { db, isDbConnected, organizations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  if (!isDbConnected()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (account.user.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can request deletion" }, { status: 403 });
  }

  const now = new Date();
  await db
    .update(organizations)
    .set({ deletionRequestedAt: now, updatedAt: now })
    .where(eq(organizations.id, account.organization.id));

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "account_deletion_requested",
    metadata: {
      scheduledPurgeAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    scheduledPurgeAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
  });
}

export async function DELETE(_req: NextRequest) {
  if (!isDbConnected()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (account.user.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can cancel deletion" }, { status: 403 });
  }

  await db
    .update(organizations)
    .set({ deletionRequestedAt: null, updatedAt: new Date() })
    .where(eq(organizations.id, account.organization.id));

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "account_deletion_cancelled",
  });

  return NextResponse.json({ ok: true });
}
