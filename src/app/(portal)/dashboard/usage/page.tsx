import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { PLANS } from "@/lib/plans";
import { getPortalData } from "@/lib/db/queries";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { db, isDbConnected, usageCounters } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { UsageHistory } from "./UsageHistory";

export const dynamic = "force-dynamic";

async function getUsageHistory(organizationId: string) {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.organizationId, organizationId))
    .orderBy(desc(usageCounters.month))
    .limit(12);
}

export default async function UsagePage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const [{ subscription, entitlements, usage, isMock }, account] = await Promise.all([
    getPortalData(userId),
    getCurrentAccount(userId),
  ]);

  const history = account.organization
    ? await getUsageHistory(account.organization.id)
    : [];

  const planKey = subscription?.plan as keyof typeof PLANS | undefined;
  const plan = planKey ? PLANS[planKey] : null;

  const draftsLimit = entitlements?.maxAiDraftsPerMonth ?? plan?.draftsLimit ?? 500;
  const inboxLimit  = entitlements?.maxInboxes ?? plan?.inboxLimit ?? 1;
  const seatLimit   = entitlements?.maxUsers ?? plan?.seatLimit ?? 2;

  const period    = new Date().toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString("sv-SE", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <DashboardHeader title="Usage" description={`Innevarande period: ${period}`} />

      <main className="flex-1 p-6 space-y-6 max-w-4xl">

        {/* Current period */}
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-6 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Innevarande period</p>
            <p className="text-sm text-white font-semibold">{period}</p>
            <p className="text-xs text-muted-foreground">Nollställs {resetDate}</p>
          </div>

          <UsageBar
            label="AI-svar genererade"
            used={usage?.aiDraftsUsed ?? 0}
            limit={draftsLimit}
            unit="svar"
            upgradeHref="/dashboard/billing"
          />
          <UsageBar
            label="Aktiva inkorgar"
            used={1}
            limit={inboxLimit}
            unit="inkorgar"
            upgradeHref="/dashboard/billing"
          />
          <UsageBar
            label="Teammedlemmar"
            used={1}
            limit={seatLimit}
            unit="platser"
            upgradeHref="/dashboard/billing"
          />
        </div>

        {/* History chart */}
        {history.length > 0 && (
          <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Historik</p>
              <p className="text-sm text-white font-semibold">AI-svar per månad</p>
              <p className="text-xs text-muted-foreground">Senaste {history.length} månaderna</p>
            </div>
            <UsageHistory
              data={history.map(r => ({
                month:       typeof r.month === "string" ? r.month : new Date(r.month).toISOString().slice(0, 7),
                aiDrafts:    r.aiDraftsUsed,
                emails:      r.emailsProcessed,
              }))}
              draftsLimit={draftsLimit}
            />
          </div>
        )}

        {history.length === 0 && !isMock && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center">
            <p className="text-sm text-muted-foreground">Ingen historik ännu</p>
            <p className="text-xs text-muted-foreground mt-1">Historik visas här när du börjar använda AI-svar.</p>
          </div>
        )}

      </main>
    </>
  );
}

function UsageBar({
  label, used, limit, unit, upgradeHref,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
  upgradeHref: string;
}) {
  const pct       = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const isWarning = pct >= 80;
  const isFull    = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-white font-medium">{label}</span>
        <span className={`text-xs tabular-nums ${isFull ? "text-red-400" : isWarning ? "text-amber-400" : "text-muted-foreground"}`}>
          {used.toLocaleString("sv-SE")} / {limit.toLocaleString("sv-SE")} {unit}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isFull ? "bg-red-400" : isWarning ? "bg-amber-400" : "bg-gradient-to-r from-primary to-cyan-300"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        <p className={`text-[10px] ${isFull ? "text-red-400" : isWarning ? "text-amber-400" : "text-muted-foreground"}`}>
          {pct}% använt{isWarning && !isFull ? " — närmar sig gränsen" : ""}
          {isFull ? " — gränsen nådd" : ""}
        </p>
        {isWarning && (
          <a href={upgradeHref} className="text-[10px] text-primary hover:underline">
            Uppgradera →
          </a>
        )}
      </div>
    </div>
  );
}
