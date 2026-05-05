import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { BarChart2 } from "lucide-react";

function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = Math.min(Math.round((used / limit) * 100), 100);
  const isWarning = pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-white font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWarning ? "bg-amber-400" : "bg-gradient-to-r from-primary to-cyan-300"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-xs ${isWarning ? "text-amber-400" : "text-muted-foreground"}`}>
        {pct}% used{isWarning ? " — approaching limit" : ""}
      </p>
    </div>
  );
}

export default function UsagePage() {
  const period = "May 2026";

  return (
    <>
      <DashboardHeader title="Usage" description={`Current period: ${period}`} />

      <main className="flex-1 p-6 space-y-6">
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart2 size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Usage this period</h2>
              <p className="text-xs text-muted-foreground">Resets on June 1, 2026</p>
            </div>
          </div>

          {/* Mock usage bars — connected to DB in Phase 3 */}
          <UsageBar label="AI Draft replies" used={847}  limit={2000} unit="drafts" />
          <UsageBar label="Active inboxes"  used={2}    limit={3}    unit="inboxes" />
          <UsageBar label="Team seats"      used={3}    limit={5}    unit="seats" />
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
          Live usage data will be tracked automatically in the next product update.
          Contact <a href="mailto:hello@mailmind.io" className="text-primary hover:underline">hello@mailmind.io</a> to adjust limits.
        </div>
      </main>
    </>
  );
}
