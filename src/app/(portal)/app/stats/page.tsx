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
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import {
  getThreadStats,
  getDraftStats,
  getTopCaseTypes,
  getResponseStats,
} from "@/lib/app/stats";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const orgId = account.organization.id;
  const [threadStats, draftStats, topCaseTypes, responseStats] = await Promise.all([
    getThreadStats(orgId),
    getDraftStats(orgId),
    getTopCaseTypes(orgId, 5),
    getResponseStats(orgId),
  ]);

  const draftLimit = account.entitlements?.maxAiDraftsPerMonth ?? 0;
  const draftsThisMonthUsed = account.usage?.aiDraftsUsed ?? 0;

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Stats</p>
          <h1 className="text-2xl font-bold text-white">{account.organization.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Activity overview for the current month
          </p>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white px-3 py-1.5 transition-colors">
          ← App home
        </Link>
      </header>

      {/* Top-line metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Threads today" value={threadStats.today} />
        <MetricCard label="This week"     value={threadStats.thisWeek} />
        <MetricCard label="This month"    value={threadStats.thisMonth} />
        <MetricCard label="All time"      value={threadStats.total} />
      </section>

      {/* AI usage */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="AI drafts this month">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{draftsThisMonthUsed.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">/ {draftLimit.toLocaleString()}</span>
          </div>
          <ProgressBar used={draftsThisMonthUsed} limit={draftLimit} />
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
            <Mini label="Ask"       value={draftStats.byAction.ask} />
            <Mini label="Summarize" value={draftStats.byAction.summarize} />
            <Mini label="Escalate"  value={draftStats.byAction.escalate} />
          </div>
        </Card>

        <Card title="Median AI response time">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {responseStats.medianMinutes !== null
                ? formatDuration(responseStats.medianMinutes)
                : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {responseStats.sampleSize > 0
              ? `Based on ${responseStats.sampleSize} customer→assistant pair${responseStats.sampleSize === 1 ? "" : "s"}`
              : "No replies sent yet — once you send AI drafts the median will populate."}
          </p>
        </Card>
      </section>

      {/* Status breakdown */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Threads by status
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-2">
          <StatusBar label="Open"      value={threadStats.byStatus.open}      total={threadStats.total} color="#22c55e" />
          <StatusBar label="Waiting"   value={threadStats.byStatus.waiting}   total={threadStats.total} color="#f59e0b" />
          <StatusBar label="Escalated" value={threadStats.byStatus.escalated} total={threadStats.total} color="#ef4444" />
          <StatusBar label="Resolved"  value={threadStats.byStatus.resolved}  total={threadStats.total} color="#6b7280" />
        </div>
      </section>

      {/* Top case types */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Top case types
        </h2>
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5">
          {topCaseTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No classified threads yet. Once the AI starts categorising emails,
              the most common types will show here.
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
    <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
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
