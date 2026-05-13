import { Activity, ShieldCheck, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { runHealthChecks, type HealthCheck, type HealthStatus } from "@/lib/admin/health";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const report = await runHealthChecks();

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight mb-2">System Health</h1>
          <p className="text-slate-400">Live status of external dependencies and environment configuration.</p>
        </div>
        <OverallBadge status={report.overall} />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryTile label="OK"   value={report.summary.ok}   tone="ok"   />
        <SummaryTile label="Warn" value={report.summary.warn} tone="warn" />
        <SummaryTile label="Fail" value={report.summary.fail} tone="fail" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Endpoint card */}
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-bold">Public endpoint</h2>
              <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Authenticated via Secret</p>
            </div>
          </div>

          <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
            <p className="text-slate-300 text-xs">
              For external monitoring (Pingdom, BetterUptime, etc):
            </p>
            <code className="block p-2 bg-[#030614] rounded-lg text-primary text-[10px] font-mono break-all">
              /api/admin/health?secret=ADMIN_HEALTH_SECRET
            </code>
          </div>

          <Link
            href="/api/admin/health"
            target="_blank"
            className="inline-flex items-center gap-2 text-primary hover:text-cyan-300 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Open Raw JSON
            <Activity className="w-3 h-3" />
          </Link>
        </div>

        {/* Checks list */}
        <div className="lg:col-span-2 bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-bold">Checks</h2>
          <ul className="divide-y divide-white/5">
            {report.checks.map(c => (
              <CheckRow key={c.name} check={c} />
            ))}
          </ul>
        </div>
      </div>

      {/* Tips */}
      {report.tips.length > 0 && (
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-3">
          <h2 className="text-white font-bold text-sm">Troubleshooting tips</h2>
          <ul className="space-y-1.5 text-xs text-slate-400">
            {report.tips.map((t, i) => (
              <li key={i} className="leading-relaxed">• {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function OverallBadge({ status }: { status: HealthStatus }) {
  const map = {
    ok:   { label: "All systems operational", cls: "bg-green-500/15 text-green-400 border-green-500/30",   Icon: CheckCircle },
    warn: { label: "Degraded",                cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",   Icon: AlertTriangle },
    fail: { label: "Failures detected",       cls: "bg-red-500/15 text-red-400 border-red-500/30",         Icon: XCircle },
  } as const;
  const { label, cls, Icon } = map[status];
  return (
    <div className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border ${cls}`}>
      <Icon className="w-5 h-5" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: HealthStatus }) {
  const toneCls = {
    ok:   "text-green-400",
    warn: "text-amber-400",
    fail: "text-red-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-white/5 bg-[#050B1C] p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  const icons = {
    ok:   <CheckCircle    className="w-4 h-4 text-green-500 shrink-0" />,
    warn: <AlertTriangle  className="w-4 h-4 text-yellow-500 shrink-0" />,
    fail: <XCircle        className="w-4 h-4 text-red-500 shrink-0" />,
  };
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {icons[check.status]}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{check.name}</p>
        {check.detail && (
          <p className="text-[11px] text-muted-foreground mt-0.5 break-words font-mono">{check.detail}</p>
        )}
      </div>
    </li>
  );
}
