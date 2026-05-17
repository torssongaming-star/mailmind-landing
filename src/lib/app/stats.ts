/**
 * Stats queries for /app/stats.
 *
 * All scoped to a single organization. Returns aggregate counts the dashboard
 * can render directly. Falls back to zeros when DATABASE_URL isn't set.
 */

import { sql, eq, and, gte, lt, desc, count } from "drizzle-orm";
import {
  db,
  isDbConnected,
  emailThreads,
  emailMessages,
  aiDrafts,
  caseTypes,
} from "@/lib/db";
import { z } from "zod";

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

    const result = await db.execute(sql`
      SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM email_threads
      WHERE organization_id = ${organizationId}
        AND created_at >= ${since.toISOString()}
      GROUP BY day
      ORDER BY day ASC
    `);
  
    const schema = z.array(z.object({ day: z.string(), count: z.number() }));
    const rows = schema.parse(result.rows);
  
    const byDay = new Map(rows.map(r => [r.day, Number(r.count)]));
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
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','approved','edited') AND user_id IS NULL)     AS auto,
        COUNT(*) FILTER (WHERE status IN ('sent','approved','edited') AND user_id IS NOT NULL) AS manual,
        COUNT(*) FILTER (WHERE status = 'rejected')                                            AS rejected
      FROM ai_drafts
      WHERE organization_id = ${organizationId}
        AND generated_at >= ${monthStart.toISOString()}
        AND is_dry_run = false
    `);
  
    const schema = z.array(z.object({ 
      auto: z.union([z.string(), z.number()]), 
      manual: z.union([z.string(), z.number()]), 
      rejected: z.union([z.string(), z.number()]) 
    }));
    const rows = schema.parse(result.rows);
    const row = rows[0];
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

    const result = await db.execute(sql`
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
    `);
  
    const schema = z.array(z.object({ 
      sample: z.union([z.string(), z.number()]), 
      median: z.union([z.string(), z.number()]).nullable() 
    }));
    const rows = schema.parse(result.rows);
    const row = rows[0];
  if (!row || !row.sample) return { medianMinutes: null, sampleSize: 0 };
  return {
    medianMinutes: row.median !== null ? Number(row.median) : null,
    sampleSize:    Number(row.sample),
  };
}

// ── Weekly report stats ───────────────────────────────────────────────────────

export type WeeklyStats = {
  orgName:          string;
  weekStart:        Date;
  weekEnd:          Date;
  newThreads:       number;
  resolvedThreads:  number;
  escalatedThreads: number;
  draftsSent:       number;
  topCaseType:      string | null;
};

/**
 * AI quality metrics — strategi-revision P3.2.
 *
 * "Hur väl presterar AI:n?" — kvantifierat. Visas på /app/stats för agenten
 * och på admin/organizations/[id] för Mailmind-teamet.
 *
 * Scoped to last N days (default 30).
 *
 * Returns:
 *   - totalDrafts: alla genererade utkast (inkl dry-run)
 *   - approvalRate: andel som skickas utan edit
 *   - editRate: andel som skickas efter att agenten redigerat
 *   - rejectionRate: andel som agenten avvisat
 *   - escalationRate: andel som AI:n flaggat för eskalering
 *   - autoSendRate: andel som auto-skickades (utan agent-touch)
 *   - avgConfidence: medel-confidence på sent/approved drafts
 *   - p50ResponseMinutes: median tid från draft-generation till sent
 *   - sourceGroundedRate: andel sent drafts där AI:n citerade KB
 */
export type AiQualityMetrics = {
  windowDays:          number;
  totalDrafts:         number;
  byAction:            { ask: number; summarize: number; escalate: number };
  byStatus:            { pending: number; approved: number; edited: number; sent: number; rejected: number };
  approvalRate:        number;       // sent (utan edit) / total beslutade (sent + rejected)
  editRate:            number;       // (edited→sent) / total beslutade
  rejectionRate:       number;       // rejected / total beslutade
  escalationRate:      number;       // escalate-action / total beslutade
  autoSendRate:        number;       // user_id IS NULL & sent / total sent
  avgConfidence:       number | null;
  p50ResponseMinutes:  number | null;
  sourceGroundedRate:  number | null;
};

export async function getAiQualityMetrics(
  organizationId: string,
  windowDays = 30,
): Promise<AiQualityMetrics> {
  const empty: AiQualityMetrics = {
    windowDays,
    totalDrafts: 0,
    byAction:  { ask: 0, summarize: 0, escalate: 0 },
    byStatus:  { pending: 0, approved: 0, edited: 0, sent: 0, rejected: 0 },
    approvalRate: 0, editRate: 0, rejectionRate: 0, escalationRate: 0,
    autoSendRate: 0, avgConfidence: null, p50ResponseMinutes: null,
    sourceGroundedRate: null,
  };
  if (!isDbConnected()) return empty;

  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const since   = new Date(sinceMs);

  // One big aggregation — cheap on indexed (org, generated_at) lookups.
  const result = await db.execute(sql`
    SELECT
      COUNT(*)                                                              AS total,
      COUNT(*) FILTER (WHERE action = 'ask')                                AS act_ask,
      COUNT(*) FILTER (WHERE action = 'summarize')                          AS act_summarize,
      COUNT(*) FILTER (WHERE action = 'escalate')                           AS act_escalate,
      COUNT(*) FILTER (WHERE status = 'pending')                            AS st_pending,
      COUNT(*) FILTER (WHERE status = 'approved')                           AS st_approved,
      COUNT(*) FILTER (WHERE status = 'edited')                             AS st_edited,
      COUNT(*) FILTER (WHERE status = 'sent')                               AS st_sent,
      COUNT(*) FILTER (WHERE status = 'rejected')                           AS st_rejected,
      COUNT(*) FILTER (WHERE status = 'sent' AND user_id IS NULL)           AS auto_sent,
      AVG((metadata->>'confidence')::float)
        FILTER (WHERE status IN ('sent','approved'))                        AS avg_conf,
      COUNT(*) FILTER (WHERE status = 'sent'
                          AND (metadata->>'source_grounded')::boolean = true) AS sg_count,
      COUNT(*) FILTER (WHERE status = 'sent')                               AS sent_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
        EXTRACT(EPOCH FROM (sent_at - generated_at)) / 60.0
      ) FILTER (WHERE sent_at IS NOT NULL)                                  AS p50_min
    FROM ai_drafts
    WHERE organization_id = ${organizationId}
      AND generated_at >= ${since.toISOString()}
      AND is_dry_run = false
  `);

  type Row = {
    total:        string | number;
    act_ask:      string | number; act_summarize: string | number; act_escalate: string | number;
    st_pending:   string | number; st_approved: string | number; st_edited: string | number;
    st_sent:      string | number; st_rejected: string | number;
    auto_sent:    string | number;
    avg_conf:     string | number | null;
    sg_count:     string | number;
    sent_count:   string | number;
    p50_min:      string | number | null;
  };
  const row = (result.rows[0] ?? {}) as Row;
  const n = (v: string | number | null | undefined) => Number(v ?? 0);

  const sent     = n(row.st_sent);
  const rejected = n(row.st_rejected);
  const edited   = n(row.st_edited);
  const decided  = sent + rejected;

  return {
    windowDays,
    totalDrafts:    n(row.total),
    byAction:       { ask: n(row.act_ask), summarize: n(row.act_summarize), escalate: n(row.act_escalate) },
    byStatus:       {
      pending:  n(row.st_pending),  approved: n(row.st_approved),
      edited,   sent,                rejected,
    },
    approvalRate:   decided > 0 ? sent / decided : 0,
    editRate:       decided > 0 ? edited / decided : 0,
    rejectionRate:  decided > 0 ? rejected / decided : 0,
    escalationRate: n(row.total) > 0 ? n(row.act_escalate) / n(row.total) : 0,
    autoSendRate:   sent > 0 ? n(row.auto_sent) / sent : 0,
    avgConfidence:  row.avg_conf !== null ? Number(row.avg_conf) : null,
    p50ResponseMinutes: row.p50_min !== null ? Number(row.p50_min) : null,
    sourceGroundedRate: n(row.sent_count) > 0 ? n(row.sg_count) / n(row.sent_count) : null,
  };
}

/**
 * Returns the stats for the past 7 days for a given org.
 * Used by the weekly email report cron task.
 */
export async function getWeeklyStats(
  organizationId: string,
  orgName: string,
): Promise<WeeklyStats> {
  const weekEnd   = new Date();
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const empty: WeeklyStats = {
    orgName, weekStart, weekEnd,
    newThreads: 0, resolvedThreads: 0, escalatedThreads: 0,
    draftsSent: 0, topCaseType: null,
  };

  if (!isDbConnected()) return empty;

  const [newRows, resolvedRows, escalatedRows, draftRows, caseRows] = await Promise.all([
    // New threads this week
    db.select({ c: count() })
      .from(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, organizationId),
        gte(emailThreads.createdAt, weekStart),
        lt(emailThreads.createdAt, weekEnd),
      )),

    // Resolved threads this week
    db.select({ c: count() })
      .from(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, organizationId),
        eq(emailThreads.status, "resolved"),
        gte(emailThreads.updatedAt, weekStart),
        lt(emailThreads.updatedAt, weekEnd),
      )),

    // Escalated threads this week
    db.select({ c: count() })
      .from(emailThreads)
      .where(and(
        eq(emailThreads.organizationId, organizationId),
        eq(emailThreads.status, "escalated"),
        gte(emailThreads.updatedAt, weekStart),
        lt(emailThreads.updatedAt, weekEnd),
      )),

    // AI drafts sent this week
    db.select({ c: count() })
      .from(aiDrafts)
      .where(and(
        eq(aiDrafts.organizationId, organizationId),
        eq(aiDrafts.status, "sent"),
        gte(aiDrafts.generatedAt, weekStart),
        lt(aiDrafts.generatedAt, weekEnd),
      )),

    // Top case type this week (by thread count)
    db.select({
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
        gte(emailThreads.createdAt, weekStart),
        lt(emailThreads.createdAt, weekEnd),
      ))
      .groupBy(emailThreads.caseTypeSlug, caseTypes.label)
      .orderBy(desc(count()))
      .limit(1),
  ]);

  const topRow     = caseRows[0];
  const topCaseType = topRow?.label ?? topRow?.slug ?? null;

  return {
    orgName,
    weekStart,
    weekEnd,
    newThreads:       Number(newRows[0]?.c       ?? 0),
    resolvedThreads:  Number(resolvedRows[0]?.c  ?? 0),
    escalatedThreads: Number(escalatedRows[0]?.c ?? 0),
    draftsSent:       Number(draftRows[0]?.c      ?? 0),
    topCaseType,
  };
}
