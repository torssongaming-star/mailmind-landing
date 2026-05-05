import { auth } from "@clerk/nextjs/server";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { PLANS } from "@/lib/stripe";
import { getPortalData } from "@/lib/db/queries";
import { BarChart2, Database } from "lucide-react";

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

export default async function UsagePage() {
  const { userId } = await auth();
  if (!userId) return null;

  const { subscription, entitlements, usage, isMock } = await getPortalData(userId);

  const planKey = subscription?.plan as keyof typeof PLANS | undefined;
  const plan = planKey ? PLANS[planKey] : null;

  const period = new Date().toLocaleDateString("en-IE", { month: "long", year: "numeric" });
  const resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("en-IE", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <DashboardHeader title="Usage" description={`Current period: ${period}`} />

      <main className="flex-1 p-6 space-y-6">
        {/* Mock/Preview Banner */}
        {isMock && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <Database size={16} className="shrink-0" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider">Preview Mode</p>
              <p className="text-xs opacity-80 mt-0.5">Showing mock usage data. Connect Neon Postgres to see live stats.</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart2 size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Usage this period</h2>
              <p className="text-xs text-muted-foreground">Resets on {resetDate}</p>
            </div>
          </div>

          <UsageBar
            label="AI Draft replies"
            used={usage?.aiDraftsUsed ?? 0}
            limit={entitlements?.maxAiDraftsPerMonth ?? plan?.draftsLimit ?? 500}
            unit="drafts"
          />
          <UsageBar
            label="Active inboxes"
            used={usage?.emailsProcessed ?? 0}
            limit={entitlements?.maxInboxes ?? plan?.inboxLimit ?? 1}
            unit="inboxes"
          />
          <UsageBar
            label="Team seats"
            used={1} // Static for now
            limit={entitlements?.maxUsers ?? plan?.seatLimit ?? 2}
            unit="seats"
          />
        </div>

        {isMock && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
            Usage is tracked at the organization level. Admin roles can manage limits via the billing portal.
          </div>
        )}
      </main>
    </>
  );
}
