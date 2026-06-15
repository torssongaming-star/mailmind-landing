/**
 * /app/stats — usage + activity dashboard for the org.
 *
 * Server component, single render. Pulls all stats in parallel from
 * lib/app/stats and visualises them with simple cards + bars (no charting
 * library — keeps bundle size low and works perfectly fine for the data
 * volume we expect).
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BarChart2 } from "lucide-react";

import { getCurrentAccount } from "@/lib/app/entitlements";
import {
  getThreadStats,
  getDraftStats,
  getTopCaseTypes,
  getResponseStats,
  getThreadsPerDay,
  getAutoVsManualSent,
  getAiQualityMetrics,
} from "@/lib/app/stats";
// Lazy client wrapper around DailyThreadsChart — keeps recharts (~351 KB) in
// a code-split chunk loaded only when this route renders on the client.
// Wrapper is needed because `next/dynamic` with `ssr: false` isn't allowed in
// Server Components, and this page is async/server.
import { LazyDailyThreadsChart } from "./LazyDailyThreadsChart";
import { getTranslations } from "@/lib/i18n";
import { getUserLocale } from "@/lib/i18n/get-locale";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Statistik" };

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const locale = await getUserLocale();
  const { t } = getTranslations(locale);

  const orgId = account.organization.id;
  const [threadStats, draftStats, topCaseTypes, responseStats, dailyThreads, autoVsManual, aiQuality] = await Promise.all([
    getThreadStats(orgId),
    getDraftStats(orgId),
    getTopCaseTypes(orgId, 5),
    getResponseStats(orgId),
    getThreadsPerDay(orgId, 14),
    getAutoVsManualSent(orgId),
    getAiQualityMetrics(orgId, 30),
  ]);

  const totalSent = autoVsManual.auto + autoVsManual.manual;
  const autoPct   = totalSent > 0 ? Math.round((autoVsManual.auto / totalSent) * 100) : 0;

  const draftLimit = account.entitlements?.maxAiDraftsPerMonth ?? 0;
  const draftsThisMonthUsed = account.usage?.aiDraftsUsed ?? 0;

  if (threadStats.total === 0) {
    return (
      <main className="max-w-4xl mx-auto p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(255,255,255,0.02)]">
          <BarChart2 size={28} className="text-white/40" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-white">Ingen statistik ännu</h2>
          <p className="text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
            Här kommer du kunna följa upp svarstider, AI-kvalitet och volymer. Gå till inkorgen och låt AI:n triagera lite mejl för att fylla på!
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">

      {/* Top-line metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={t("portal.stats.metrics.today")} value={threadStats.today} />
        <MetricCard label={t("portal.stats.metrics.week")}     value={threadStats.thisWeek} />
        <MetricCard label={t("portal.stats.metrics.month")}    value={threadStats.thisMonth} />
        <MetricCard label={t("portal.stats.metrics.total")}      value={threadStats.total} />
      </section>

      {/* Daily thread volume */}
      <section>
        <h2 className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">
          {t("portal.stats.charts.dailyThreads")}
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5">
          <LazyDailyThreadsChart data={dailyThreads} />
        </div>
      </section>

      {/* Auto-sent vs manual */}
      <section>
        <h2 className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">
          {t("portal.stats.charts.autoVsManual")}
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 space-y-4">
          {totalSent === 0 && autoVsManual.rejected === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {t("portal.stats.charts.noData")}
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-white tracking-tight tabular-nums">{autoPct}%</span>
                <span className="text-xs text-white/70">
                  {t("portal.stats.charts.autoPct", { pct: autoPct.toString(), total: totalSent.toString() })}
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-primary to-cyan-300 transition-all duration-500"
                  style={{ width: `${totalSent > 0 ? (autoVsManual.auto / totalSent) * 100 : 0}%` }}
                  title={`${t("portal.stats.charts.labels.auto")}: ${autoVsManual.auto}`}
                />
                <div
                  className="h-full bg-amber-400/60 transition-all duration-500"
                  style={{ width: `${totalSent > 0 ? (autoVsManual.manual / totalSent) * 100 : 0}%` }}
                  title={`${t("portal.stats.charts.labels.manual")}: ${autoVsManual.manual}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                <Mini label={t("portal.stats.charts.labels.auto")}     value={autoVsManual.auto} />
                <Mini label={t("portal.stats.charts.labels.manual")}  value={autoVsManual.manual} />
                <Mini label={t("portal.stats.charts.labels.rejected")} value={autoVsManual.rejected} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* AI usage */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t("portal.stats.aiUsage.title")}>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight tabular-nums">{draftsThisMonthUsed.toLocaleString()}</span>
            <span className="text-sm text-white/60 tabular-nums">/ {draftLimit.toLocaleString()}</span>
          </div>
          <ProgressBar used={draftsThisMonthUsed} limit={draftLimit} />
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
            <Mini label={t("inbox.thread.actions.ask")}       value={draftStats.byAction.ask} />
            <Mini label={t("inbox.thread.actions.summarize")} value={draftStats.byAction.summarize} />
            <Mini label={t("inbox.thread.actions.escalate")}  value={draftStats.byAction.escalate} />
          </div>
        </Card>

        <Card title={t("portal.stats.aiUsage.medianTime")}>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight tabular-nums">
              {responseStats.medianMinutes !== null
                ? formatDuration(responseStats.medianMinutes)
                : "—"}
            </span>
          </div>
          <p className="text-xs text-white/65 mt-2">
            {responseStats.sampleSize > 0
              ? t("portal.stats.aiUsage.sampleSize", { count: responseStats.sampleSize.toString() })
              : t("portal.stats.aiUsage.noReplies")}
          </p>
        </Card>
      </section>

      {/* AI quality metrics — P3.2 */}
      <section>
        <h2 className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">
          AI-kvalitet · senaste {aiQuality.windowDays} dagar
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-6 space-y-6">
          {/* Top KPI-row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QualityKpi
              label="Godkänd direkt"
              value={`${Math.round(aiQuality.approvalRate * 100)}%`}
              hint={`${aiQuality.byStatus.sent} av ${aiQuality.byStatus.sent + aiQuality.byStatus.rejected}`}
              tone={aiQuality.approvalRate >= 0.7 ? "green" : aiQuality.approvalRate >= 0.4 ? "amber" : "red"}
            />
            <QualityKpi
              label="Redigerad innan skick"
              value={`${Math.round(aiQuality.editRate * 100)}%`}
              hint={`${aiQuality.byStatus.edited} utkast`}
              tone="neutral"
            />
            <QualityKpi
              label="Avvisad"
              value={`${Math.round(aiQuality.rejectionRate * 100)}%`}
              hint={`${aiQuality.byStatus.rejected} avvisade`}
              tone={aiQuality.rejectionRate <= 0.1 ? "green" : aiQuality.rejectionRate <= 0.25 ? "amber" : "red"}
            />
            <QualityKpi
              label="Eskalerade"
              value={`${Math.round(aiQuality.escalationRate * 100)}%`}
              hint={`${aiQuality.byAction.escalate} ärenden till människa`}
              tone="neutral"
            />
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-white/5">
            <QualityKpi
              label="Snittsäkerhet"
              value={aiQuality.avgConfidence !== null ? `${Math.round(aiQuality.avgConfidence * 100)}%` : "—"}
              hint="över godkända svar"
              tone="neutral"
            />
            <QualityKpi
              label="Median-svarstid"
              value={aiQuality.p50ResponseMinutes !== null ? formatDuration(aiQuality.p50ResponseMinutes) : "—"}
              hint="från utkast till skickat"
              tone="neutral"
            />
            <QualityKpi
              label="Källgrundade"
              value={aiQuality.sourceGroundedRate !== null ? `${Math.round(aiQuality.sourceGroundedRate * 100)}%` : "—"}
              hint="av skickade svar"
              tone={aiQuality.sourceGroundedRate !== null && aiQuality.sourceGroundedRate >= 0.8 ? "green" : "neutral"}
            />
            <QualityKpi
              label="Auto-skickade"
              value={`${Math.round(aiQuality.autoSendRate * 100)}%`}
              hint="utan agent-touch"
              tone="neutral"
            />
          </div>

          {aiQuality.totalDrafts === 0 && (
            <p className="text-xs text-white/65 italic text-center pt-2">
              Inga AI-utkast än under perioden. Statistiken fylls på när AI:n börjar arbeta.
            </p>
          )}
        </div>
      </section>

      {/* Status breakdown */}
      <section>
        <h2 className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">
          {t("portal.stats.status.title")}
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 space-y-2">
          <StatusBar label={t("portal.stats.status.labels.open")}      value={threadStats.byStatus.open}      total={threadStats.total} color="#22c55e" />
          <StatusBar label={t("portal.stats.status.labels.waiting")}   value={threadStats.byStatus.waiting}   total={threadStats.total} color="#f59e0b" />
          <StatusBar label={t("portal.stats.status.labels.escalated")} value={threadStats.byStatus.escalated} total={threadStats.total} color="#ef4444" />
          <StatusBar label={t("portal.stats.status.labels.resolved")}  value={threadStats.byStatus.resolved}  total={threadStats.total} color="#6b7280" />
        </div>
      </section>

      {/* Top case types */}
      <section>
        <h2 className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">
          {t("portal.stats.caseTypes.title")}
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5">
          {topCaseTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              {t("portal.stats.caseTypes.noData")}
            </p>
          ) : (
            <ul className="space-y-2">
              {topCaseTypes.map((ct, i) => {
                const max = Math.max(...topCaseTypes.map(c => c.count));
                const pct = max > 0 ? (ct.count / max) * 100 : 0;
                return (
                  <li key={ct.slug || i} className="flex items-center gap-3">
                    <span className="text-xs text-white w-32 truncate">{ct.label}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                      {ct.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="group rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm p-4 transition-colors duration-200 hover:border-white/12">
      <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tight tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm p-5">
      <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

/** Single AI-quality KPI tile — P3.2. Used in the AI quality dashboard. */
function QualityKpi({
  label, value, hint, tone,
}: {
  label: string;
  value: string;
  hint:  string;
  tone:  "green" | "amber" | "red" | "neutral";
}) {
  const toneClass = {
    green:   "text-green-400",
    amber:   "text-amber-400",
    red:     "text-red-400",
    neutral: "text-white",
  }[tone];
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">{label}</p>
      <p className={`text-2xl font-bold tracking-tight tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-[11px] text-white/60">{hint}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/60 uppercase tracking-widest font-medium">{label}</p>
    </div>
  );
}

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const warn = pct >= 80;
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
      <div
        className={`h-full rounded-full ${warn ? "bg-amber-400" : "bg-gradient-to-r from-primary to-cyan-300"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusBar({
  label, value, total, color,
}: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{value}</span>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}
