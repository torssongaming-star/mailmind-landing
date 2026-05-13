/**
 * Stats queries for /app/stats.
 *
 * All scoped to a single organization. Returns aggregate counts the dashboard
 * can render directly. Falls back to zeros when DATABASE_URL isn't set.
 */

import { sql, eq, and, gte, desc, count } from "drizzle-orm";
import {
  db,
  isDbConnected,
  emailThreads,
  emailMessages,
  aiDrafts,
  caseTypes,
} from "@/lib/db";

export type ThreadStats = {
  total:        number;
  today:        number;
  thisWeek:     number;
  thisMonth:    number;
  byStatus: {
    open:       number;
    waiting:    number;
    escalated:  number;
    resolved:   number;
  };
};

export type DraftStats = {
  total:                  number;
  pending:                number;
  sent:                   number;
  rejected:               number;
  byAction: {
    ask:                  number;
    summarize:            number;
    escalate:             number;
  };
};

export type CaseTypeStat = {
  slug:   string;
  label:  string;
  count:  number;
};

export type ResponseStat = {
  /** Median time (in minutes) between customer message and assistant reply */
  medianMinutes:          number | null;
  sampleSize:             number;
};

export type DailyThreadStat = {
  /** ISO date (YYYY-MM-DD) */
  date:   string;
  count:  number;
};

export type AutoVsManualStat = {
  auto:     number;
  manual:   number;
  rejected: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOf(unit: "day" | "week" | "month"): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (unit === "week") {
    // Monday as start of week (Swedish norm)
    const dow = d.getDay();
    const diff = (dow + 6) % 7;
    d.setDate(d.getDate() - diff);
  } else if (unit === "month") {
    d.setDate(1);
  }
  return d;
}

// ── Thread stats ─────────────────────────────────────────────────────────────

export async function getThreadStats(organizationId: string): Promise<ThreadStats> {
  const empty: ThreadStats = {
    total: 0, today: 0, thisWeek: 0, thisMonth: 0,
    byStatus: { open: 0, waiting: 0, escalated: 0, resolved: 0 },
  };
  if (!isDbConnected()) return empty;

  const [totalRows, todayRows, weekRows, monthRows, statusRows] = await Promise.all([
    db.select({ c: count() })
      .from(emailThreads)
      .where(eq(emailThreads.organizationId, organizationId)),
    db.select({ c: count() })
      .from(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, organizationId),
        gte(emailThreads.createdAt, startOf("day")),
      )),
    db.select({ c: count() })
      .from(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, organizationId),
        gte(emailThreads.createdAt, startOf("week")),
      )),
    db.select({ c: count() })
      .from(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, organizationId),
        gte(emailThreads.createdAt, startOf("month")),
      )),
    db.select({ status: emailThreads.status, c: count() })
      .from(emailThreads)
      .where(eq(emailThreads.organizationId, organizationId))
      .groupBy(emailThreads.status),
  ]);

  const byStatus = { open: 0, waiting: 0, escalated: 0, resolved: 0 };
  for (const row of statusRows) {
    if (row.status in byStatus) {
      byStatus[row.status as keyof typeof byStatus] = Number(row.c);
    }
  }

  return {
    total:     Number(totalRows[0]?.c ?? 0),
    today:     Number(todayRows[0]?.c ?? 0),
    thisWeek:  Number(weekRows[0]?.c ?? 0),
    thisMonth: Number(monthRows[0]?.c ?? 0),
    byStatus,
  };
}

// ── Draft stats ──────────────────────────────────────────────────────────────

export async function getDraftStats(organizationId: string): Promise<DraftStats> {
  const empty: DraftStats = {
    total: 0, pending: 0, sent: 0, rejected: 0,
    byAction: { ask: 0, summarize: 0, escalate: 0 },
  };
  if (!isDbConnected()) return empty;

  const monthStart = startOf("month");

  const [statusRows, actionRows] = await Promise.all([
    db.select({ status: aiDrafts.status, c: count() })
      .from(aiDrafts)
      .where(and(
        eq(aiDrafts.organizationId, organizationId),
        gte(aiDrafts.generatedAt, monthStart),
      ))
      .groupBy(aiDrafts.status),
    db.select({ action: aiDrafts.action, c: count() })
      .from(aiDrafts)
      .where(and(
        eq(aiDrafts.organizationId, organizationId),
        gte(aiDrafts.generatedAt, monthStart),
      ))
      .groupBy(aiDrafts.action),
  ]);

  let total = 0;
  const byStatus: Record<string, number> = { pending: 0, sent: 0, rejected: 0, edited: 0, approved: 0 };
  for (const row of statusRows) {
    const c = Number(row.c);
    total += c;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + c;
  }

  const byAction = { ask: 0, summarize: 0, escalate: 0 };
  for (const row of actionRows) {
    if (row.action in byAction) {
      byAction[row.action as keyof typeof byAction] = Number(row.c);
    }
  }

  return {
    total,
    pending:  byStatus.pending,
    sent:     byStatus.sent + byStatus.edited + byStatus.approved,
    rejected: byStatus.rejected,
    byAction,
  };
}

// ── Top case types ───────────────────────────────────────────────────────────

export async function getTopCaseTypes(
  organizationId: string,
  limit = 5
): Promise<CaseTypeStat[]> {
  if (!isDbConnected()) return [];

  // Threads with caseTypeSlug + their resolved label from case_types table
  const rows = await db
    .select({
      slug:  emailThreads.caseTypeSlug,
      label: caseTypes.label,
      c:     count(),
    })
    .from(emailThreads)
    .leftJoin(caseTypes, and(
      eq(caseTypes.organizationId, organizationId),
      eq(caseTypes.slug, emailThreads.caseTypeSlug),
    ))
    .where(and(
      eq(emailThreads.organizationId, organizationId),
      sql`${emailThreads.caseTypeSlug} IS NOT NULL`,
    ))
    .groupBy(emailThreads.caseTypeSlug, caseTypes.label)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map(r => ({
    slug:  r.slug ?? "",
    label: r.label ?? r.slug ?? "(unknown)",
    count: Number(r.c),
  }));
}

// ── Threads per day (last N days, inclusive of today) ───────────────────────

/**
 * Returns an array of length `days`, one entry per day from oldest to newest.
 * Missing days are filled with zero so the chart has no gaps.
 */
export async function getThreadsPerDay(
  organizationId: string,
  days = 14,
): Promise<DailyThreadStat[]> {
  // Build skeleton with zeros so missing-day gaps render cleanly
  const skeleton: DailyThreadStat[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    skeleton.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }

  if (!isDbConnected()) return skeleton;

  const since = new Date(today);
  since.setDate(today.getDate() - (days - 1));

  const rows = (await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS count
    FROM email_threads
    WHERE organization_id = ${organizationId}
      AND created_at >= ${since.toISOString()}
    GROUP BY day
    ORDER BY day ASC
  `)) as unknown as { rows: Array<{ day: string; count: number }> };

  const byDay = new Map(rows.rows.map(r => [r.day, Number(r.count)]));
  return skeleton.map(s => ({ date: s.date, count: byDay.get(s.date) ?? 0 }));
}

// ── Auto-sent vs manual ──────────────────────────────────────────────────────

/**
 * Distinguishes drafts sent automatically (userId IS NULL, executed by the
 * autosvar-pipeline) from drafts sent manually by a human reviewer. Scoped
 * to the current calendar month for "this month's mix" reporting.
 */
export async function getAutoVsManualSent(organizationId: string): Promise<AutoVsManualStat> {
  if (!isDbConnected()) return { auto: 0, manual: 0, rejected: 0 };

  const monthStart = startOf("month");
  const rows = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','approved','edited') AND user_id IS NULL)     AS auto,
      COUNT(*) FILTER (WHERE status IN ('sent','approved','edited') AND user_id IS NOT NULL) AS manual,
      COUNT(*) FILTER (WHERE status = 'rejected')                                            AS rejected
    FROM ai_drafts
    WHERE organization_id = ${organizationId}
      AND generated_at >= ${monthStart.toISOString()}
      AND is_dry_run = false
  `)) as unknown as { rows: Array<{ auto: string | number; manual: string | number; rejected: string | number }> };

  const row = rows.rows[0];
  return {
    auto:     Number(row?.auto ?? 0),
    manual:   Number(row?.manual ?? 0),
    rejected: Number(row?.rejected ?? 0),
  };
}

// ── Median response time ─────────────────────────────────────────────────────

/**
 * For each thread, find the time delta between the latest customer message
 * and the next assistant message (if any). Return the median of those deltas.
 *
 * Implementation: a single SQL CTE with LATERAL JOIN. Fast for thousands of
 * rows; not optimised for hundreds of thousands.
 */
export async function getResponseStats(organizationId: string): Promise<ResponseStat> {
  if (!isDbConnected()) return { medianMinutes: null, sampleSize: 0 };

  const result = (await db.execute(sql`
    WITH pairs AS (
      SELECT
        m.thread_id,
        m.sent_at AS customer_at,
        (SELECT MIN(m2.sent_at)
         FROM ${emailMessages} m2
         WHERE m2.thread_id = m.thread_id
           AND m2.role = 'assistant'
           AND m2.sent_at > m.sent_at
        ) AS assistant_at
      FROM ${emailMessages} m
      JOIN ${emailThreads} t ON t.id = m.thread_id
      WHERE t.organization_id = ${organizationId}
        AND m.role = 'customer'
    ),
    deltas AS (
      SELECT EXTRACT(EPOCH FROM (assistant_at - customer_at)) / 60 AS minutes
      FROM pairs
      WHERE assistant_at IS NOT NULL
    )
    SELECT
      COUNT(*)                                        AS sample,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes) AS median
    FROM deltas
  `)) as unknown as { rows: Array<{ sample: string | number; median: string | number | null }> };

  const row = result.rows?.[0];
  if (!row || !row.sample) return { medianMinutes: null, sampleSize: 0 };
  return {
    medianMinutes: row.median !== null ? Number(row.median) : null,
    sampleSize:    Number(row.sample),
  };
}
