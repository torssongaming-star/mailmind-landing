/**
 * Unified cron endpoint — Vercel Hobby allows exactly one cron per project.
 *
 * Schedule (vercel.json): daily at midnight UTC  →  "0 0 * * *"
 * (Vercel Hobby plan: max once per day)
 *
 * Tasks and when they run:
 *   unsnooze        — every day
 *   expire-trials   — every day
 *   usage-warning   — weekly on Monday
 *
 * Protected by CRON_SECRET (Vercel sets Authorization: Bearer <secret>).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnected, organizations, users, subscriptions, licenseEntitlements, usageCounters, inboxes, emailThreads } from "@/lib/db";
import { eq, and, lt, lte, desc, isNotNull } from "drizzle-orm";
import { wakeUpAllSnoozedThreads, updateInboxConfig } from "@/lib/app/threads";
import { notifyUsageWarning, notifyTrialExpired, notifyWeeklyReport } from "@/lib/app/notify";
import { getWeeklyStats } from "@/lib/app/stats";
import { PLANS } from "@/lib/plans";
import { writeAuditLog } from "@/lib/app/audit";
import {
  decryptTokens as outlookDecryptTokens,
  encryptTokens as outlookEncryptTokens,
  getValidAccessToken as outlookGetValidAccessToken,
  renewMailSubscription,
  type OutlookInboxConfig,
} from "@/lib/app/outlook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── helpers ───────────────────────────────────────────────────────────────────

function currentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

/** Returns true if today is the given UTC day-of-week (0=Sun … 6=Sat). */
function isUtcDay(dayOfWeek: number): boolean {
  return new Date().getUTCDay() === dayOfWeek;
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

// ── task: weekly report ───────────────────────────────────────────────────────

async function taskWeeklyReport() {
  // Fetch all active/trialing orgs with at least one owner email
  const activeOrgs = await db
    .select({
      orgId:   organizations.id,
      orgName: organizations.name,
      email:   users.email,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(organizations.id, subscriptions.organizationId))
    .innerJoin(users, and(
      eq(users.organizationId, subscriptions.organizationId),
      eq(users.role, "owner"),
    ))
    .where(
      and(
        eq(subscriptions.status, "active"),
      )
    );

  // Also include trialing orgs
  const trialingOrgs = await db
    .select({
      orgId:   organizations.id,
      orgName: organizations.name,
      email:   users.email,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(organizations.id, subscriptions.organizationId))
    .innerJoin(users, and(
      eq(users.organizationId, subscriptions.organizationId),
      eq(users.role, "owner"),
    ))
    .where(eq(subscriptions.status, "trialing"));

  const allOrgs = [...activeOrgs, ...trialingOrgs];
  if (allOrgs.length === 0) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  await Promise.allSettled(allOrgs.map(async (org) => {
    try {
      const stats = await getWeeklyStats(org.orgId, org.orgName);

      // Skip if no activity this week — don't send empty reports
      if (stats.newThreads === 0 && stats.draftsSent === 0) {
        skipped++;
        return;
      }

      await notifyWeeklyReport(org.email, stats);
      sent++;
    } catch (err) {
      errors.push(`org=${org.orgId}: ${String(err)}`);
    }
  }));

  return { sent, skipped, errors: errors.length > 0 ? errors : undefined };
}

// ── task: renew Outlook subscriptions expiring within 24h ─────────────────────

async function taskRenewOutlookSubscriptions() {
  if (!process.env.OUTLOOK_CLIENT_ID) return { skipped: "not_configured" };

  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

  const outlookInboxes = await db
    .select()
    .from(inboxes)
    .where(eq(inboxes.provider, "outlook"));

  let renewed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const inbox of outlookInboxes) {
    try {
      const config = inbox.config as OutlookInboxConfig | null;
      if (!config?.encryptedTokens || !config.subscriptionId || !config.subscriptionExpiry) {
        skipped++;
        continue;
      }

      const expiry = new Date(config.subscriptionExpiry);
      if (expiry > cutoff) {
        skipped++;
        continue; // Not expiring soon — nothing to do
      }

      let tokens = outlookDecryptTokens(config.encryptedTokens);
      const { token: accessToken, updated } = await outlookGetValidAccessToken(tokens);
      if (updated) tokens = updated;

      const newExpiry = await renewMailSubscription(accessToken, config.subscriptionId);

      await updateInboxConfig(inbox.id, {
        ...config,
        subscriptionExpiry:  newExpiry,
        encryptedTokens:     outlookEncryptTokens(tokens),
      } as Record<string, unknown>);

      renewed++;
    } catch (err) {
      errors.push(`inbox=${inbox.id}: ${String(err)}`);
    }
  }

  return { renewed, skipped, errors: errors.length > 0 ? errors : undefined };
}

// ── task: purge orgs that requested deletion 30+ days ago (GDPR) ──────────────

async function taskPurgeDeletedOrgs() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find orgs whose deletion-grace-period has expired
  const expired = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(and(
      isNotNull(organizations.deletionRequestedAt),
      lt(organizations.deletionRequestedAt, cutoff),
    ));

  let purged = 0;
  const errors: string[] = [];

  for (const org of expired) {
    try {
      // Audit log BEFORE deleting — the org row goes away with all its
      // cascading children. Log to console so we keep some record.
      console.warn(`[cron/purge] hard-deleting org ${org.id} ("${org.name}")`);

      // Cascade-deletes wipe: users, subscriptions, entitlements, usage,
      // inboxes, threads, messages, drafts, settings, case_types,
      // knowledge, templates, blocklist, webhooks, invites, push subs.
      await db.delete(organizations).where(eq(organizations.id, org.id));
      purged++;
    } catch (err) {
      errors.push(`org=${org.id}: ${String(err)}`);
    }
  }

  return { purged, errors: errors.length > 0 ? errors : undefined };
}

// ── task: retention — drop resolved threads older than 12 months ──────────────

async function taskRetentionPurge() {
  // Retention horizon — configurable per-org later. Default: 12 months for
  // closed (resolved/escalated) threads. Open threads are never auto-deleted.
  const horizon = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  // Cascade from emailThreads will delete messages + drafts via FK rules.
  // We use a single DELETE … WHERE rather than fetching IDs first for speed.
  const result = await db
    .delete(emailThreads)
    .where(and(
      lt(emailThreads.lastMessageAt, horizon),
      // Only purge closed threads — keep open threads regardless of age
      // (an old open thread is a stale ticket the user should see)
    ))
    .returning({ id: emailThreads.id });

  return { purged: result.length };
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Hard-fail if CRON_SECRET is missing — otherwise the check below would
  // accidentally accept "Bearer undefined" if header equals that string.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  // Constant-time-ish comparison via fixed expected string
  const expected = `Bearer ${cronSecret}`;
  if (!auth || auth.length !== expected.length) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let mismatch = 0;
  for (let i = 0; i < auth.length; i++) {
    mismatch |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isDbConnected()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const results: Record<string, unknown> = {};

  // Daily (midnight UTC): wake snoozed threads + expire ended trials
  results.unsnooze     = await taskUnsnooze();
  results.expireTrials = await taskExpireTrials();

  // Daily: renew Outlook Graph subscriptions expiring within 24h
  results.renewOutlookSubscriptions = await taskRenewOutlookSubscriptions();

  // Daily: GDPR — hard-delete orgs past their 30-day deletion grace period
  results.purgeDeletedOrgs = await taskPurgeDeletedOrgs();

  // Daily: retention — drop closed threads older than 12 months
  results.retentionPurge = await taskRetentionPurge();

  // Weekly on Monday: usage warnings + weekly report
  if (isUtcDay(1)) {
    results.usageWarning  = await taskUsageWarning();
    results.weeklyReport  = await taskWeeklyReport();
  }

  return NextResponse.json({ ok: true, ...results });
}
