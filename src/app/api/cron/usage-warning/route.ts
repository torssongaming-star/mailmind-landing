/**
 * Cron: Weekly 99% usage warning
 *
 * Runs every Monday at 08:00 UTC via Vercel Cron (vercel.json).
 * Scans all orgs with usage >= 99% of their monthly AI draft limit
 * and sends a warning email to the org owner.
 *
 * Protected by CRON_SECRET — Vercel sets Authorization: Bearer <secret>
 * automatically when invoking cron routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnected, organizations, users, subscriptions, licenseEntitlements, usageCounters } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { PLANS } from "@/lib/plans";
import { notifyUsageWarning } from "@/lib/app/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function currentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isDbConnected()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const month = currentMonthIso();

  // Load all usage counters for this month
  const counters = await db
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.month, month));

  if (counters.length === 0) {
    return NextResponse.json({ sent: 0, checked: 0 });
  }

  let sent = 0;
  const errors: string[] = [];

  await Promise.allSettled(counters.map(async (counter) => {
    try {
      const orgId = counter.organizationId;

      // Load entitlements + subscription + org in parallel
      const [entRow, subRow, orgRow] = await Promise.all([
        db.select().from(licenseEntitlements).where(eq(licenseEntitlements.organizationId, orgId)).limit(1).then(r => r[0] ?? null),
        db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).orderBy(desc(subscriptions.createdAt)).limit(1).then(r => r[0] ?? null),
        db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1).then(r => r[0] ?? null),
      ]);

      if (!orgRow) return;

      // Resolve limit: entitlements → plan → default 500
      const planKey = (subRow?.plan ?? entRow?.plan) as keyof typeof PLANS | undefined;
      const limit = entRow?.maxAiDraftsPerMonth
        ?? (planKey ? PLANS[planKey]?.draftsLimit : undefined)
        ?? 500;

      const used = counter.aiDraftsUsed;
      const pct = limit > 0 ? used / limit : 0;

      // Only notify at >= 99%
      if (pct < 0.99) return;

      // Find org owner
      const ownerRow = await db
        .select({ email: users.email })
        .from(users)
        .where(and(
          eq(users.organizationId, orgId),
          eq(users.role, "owner"),
        ))
        .limit(1)
        .then(r => r[0] ?? null);

      if (!ownerRow) return;

      await notifyUsageWarning({
        toEmail:  ownerRow.email,
        used,
        limit,
        orgName:  orgRow.name,
      });

      sent++;
    } catch (err) {
      errors.push(String(err));
    }
  }));

  return NextResponse.json({
    checked: counters.length,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
