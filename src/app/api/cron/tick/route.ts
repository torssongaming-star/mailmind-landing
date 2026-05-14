/**
 * Unified cron endpoint — Vercel Hobby allows exactly one cron per project.
 *
 * Schedule (vercel.json): every 15 minutes  →  "* /15 * * * *"
 *
 * Tasks and when they run:
 *   unsnooze        — every tick (15 min)
 *   expire-trials   — daily at 00:00–00:14 UTC
 *   usage-warning   — weekly on Monday 08:00–08:14 UTC
 *
 * Protected by CRON_SECRET (Vercel sets Authorization: Bearer <secret>).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnected, organizations, users, subscriptions, licenseEntitlements, usageCounters } from "@/lib/db";
import { eq, and, lt, desc } from "drizzle-orm";
import { wakeUpAllSnoozedThreads } from "@/lib/app/threads";
import { notifyUsageWarning, notifyTrialExpired } from "@/lib/app/notify";
import { PLANS } from "@/lib/plans";
import { writeAuditLog } from "@/lib/app/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── helpers ───────────────────────────────────────────────────────────────────

function currentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

/** Returns true if the current UTC time falls within [targetHour:00, targetHour:14]. */
function isUtcWindow(dayOfWeek: number | null, hour: number): boolean {
  const now = new Date();
  const utcDay  = now.getUTCDay();   // 0=Sun … 6=Sat
  const utcHour = now.getUTCHours();
  const utcMin  = now.getUTCMinutes();
  if (dayOfWeek !== null && utcDay !== dayOfWeek) return false;
  return utcHour === hour && utcMin < 15;
}

// ── task: unsnooze ────────────────────────────────────────────────────────────

async function taskUnsnooze() {
  const woken = await wakeUpAllSnoozedThreads();
  return { woken };
}

// ── task: expire trials ───────────────────────────────────────────────────────

async function taskExpireTrials() {
  const now = new Date();

  const expiredSubs = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        lt(subscriptions.currentPeriodEnd, now),
      )
    );

  if (expiredSubs.length === 0) return { expired: 0 };

  let expired = 0;
  const errors: string[] = [];

  await Promise.allSettled(expiredSubs.map(async (sub) => {
    try {
      // Mark subscription as cancelled
      await db
        .update(subscriptions)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(subscriptions.id, sub.id));

      await writeAuditLog({
        organizationId: sub.organizationId,
        userId: null,
        action: "trial_expired",
        metadata: { subscriptionId: sub.id, plan: sub.plan },
      });

      // Notify org owner
      const ownerRow = await db
        .select({ email: users.email, orgName: organizations.name })
        .from(users)
        .innerJoin(organizations, eq(organizations.id, users.organizationId))
        .where(
          and(
            eq(users.organizationId, sub.organizationId),
            eq(users.role, "owner"),
          )
        )
        .limit(1)
        .then(r => r[0] ?? null);

      if (ownerRow) {
        await notifyTrialExpired({
          toEmail: ownerRow.email,
          orgName: ownerRow.orgName,
          plan: sub.plan,
        });
      }

      expired++;
    } catch (err) {
      errors.push(String(err));
    }
  }));

  return { expired, errors: errors.length > 0 ? errors : undefined };
}

// ── task: usage warning ───────────────────────────────────────────────────────

async function taskUsageWarning() {
  const month = currentMonthIso();

  const counters = await db
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.month, month));

  if (counters.length === 0) return { sent: 0, checked: 0 };

  let sent = 0;
  const errors: string[] = [];

  await Promise.allSettled(counters.map(async (counter) => {
    try {
      const orgId = counter.organizationId;

      const [entRow, subRow, orgRow] = await Promise.all([
        db.select().from(licenseEntitlements).where(eq(licenseEntitlements.organizationId, orgId)).limit(1).then(r => r[0] ?? null),
        db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)).orderBy(desc(subscriptions.createdAt)).limit(1).then(r => r[0] ?? null),
        db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1).then(r => r[0] ?? null),
      ]);

      if (!orgRow) return;

      const planKey = (subRow?.plan ?? entRow?.plan) as keyof typeof PLANS | undefined;
      const limit = entRow?.maxAiDraftsPerMonth
        ?? (planKey ? PLANS[planKey]?.draftsLimit : undefined)
        ?? 500;

      const pct = limit > 0 ? counter.aiDraftsUsed / limit : 0;
      if (pct < 0.80) return;

      const ownerRow = await db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.organizationId, orgId), eq(users.role, "owner")))
        .limit(1)
        .then(r => r[0] ?? null);

      if (!ownerRow) return;

      await notifyUsageWarning({
        toEmail:  ownerRow.email,
        used:     counter.aiDraftsUsed,
        limit,
        orgName:  orgRow.name,
      });

      sent++;
    } catch (err) {
      errors.push(String(err));
    }
  }));

  return { checked: counters.length, sent, errors: errors.length > 0 ? errors : undefined };
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isDbConnected()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const results: Record<string, unknown> = {};

  // Always: wake snoozed threads
  results.unsnooze = await taskUnsnooze();

  // Daily at midnight UTC: expire ended trials
  if (isUtcWindow(null, 0)) {
    results.expireTrials = await taskExpireTrials();
  }

  // Monday 08:00 UTC: usage warnings
  if (isUtcWindow(1, 8)) {
    results.usageWarning = await taskUsageWarning();
  }

  return NextResponse.json({ ok: true, ...results });
}
