import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { PLANS } from "@/lib/stripe";
import { getPortalData } from "@/lib/db/queries";
import { CreditCard, Zap, Users, Mail, Database } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  used,
  limit,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  used?: number;
  limit?: number;
}) {
  const pct = used !== undefined && limit ? Math.round((used / limit) * 100) : null;
  const isWarning = pct !== null && pct >= 80;

  return (
    <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={15} className="text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {pct !== null && (
        <div className="mt-3">
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isWarning ? "bg-amber-400" : "bg-gradient-to-r from-primary to-cyan-300"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className={`text-xs mt-1.5 ${isWarning ? "text-amber-400" : "text-muted-foreground"}`}>
            {used?.toLocaleString()} / {limit?.toLocaleString()} used
            {isWarning ? " — approaching limit" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) return null;

  const firstName = user.firstName ?? "there";

  // Fetch portal data (returns mock if DB not connected)
  const { org, subscription, entitlements, usage, isMock } = await getPortalData(userId);

  const planKey = subscription?.plan as keyof typeof PLANS | undefined;
  const plan = planKey ? PLANS[planKey] : null;
  const status = subscription?.status;

  // Format renewal date
  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IE", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const draftsUsed = usage?.aiDraftsUsed ?? 0;
  const inboxesActive = usage?.emailsProcessed ?? 0; // Mock mapping for now
  const seatsUsed = 1;

  return (
    <>
      <DashboardHeader title="Overview" description="Your plan and usage at a glance" />

      <main className="flex-1 p-6 space-y-6">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s an overview of your {org.name} account.
            </p>
          </div>
          {isMock && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
              <Database size={12} />
              Preview Mode (Mock Data)
            </div>
          )}
        </div>

        {/* Plan badge */}
        {plan && (status === "active" || status === "trialing") ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">Current Plan</p>
              <p className="text-2xl font-bold text-white">{plan.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.price}/month{renewalDate ? ` · Renews ${renewalDate}` : ""}
              </p>
            </div>
            <a
              href="/dashboard/billing"
              className="text-xs text-primary hover:text-cyan-300 transition-colors underline underline-offset-2"
            >
              Manage billing →
            </a>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white mb-1">No active subscription</p>
              <p className="text-xs text-muted-foreground">Choose a plan to unlock all features.</p>
            </div>
            <a
              href="/dashboard/billing"
              className="px-4 py-2 rounded-xl bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors"
            >
              View plans
            </a>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="AI Drafts"
            value={`${draftsUsed.toLocaleString()}`}
            icon={Zap}
            used={draftsUsed}
            limit={entitlements?.maxAiDraftsPerMonth ?? plan?.draftsLimit ?? 500}
          />
          <StatCard
            label="Inboxes"
            value={`${inboxesActive} / ${entitlements?.maxInboxes ?? plan?.inboxLimit ?? 1}`}
            sub="Active inboxes"
            icon={Mail}
          />
          <StatCard
            label="Seats"
            value={`${seatsUsed} / ${entitlements?.maxUsers ?? plan?.seatLimit ?? 2}`}
            sub="Team members"
            icon={Users}
          />
          <StatCard
            label="Plan"
            value={plan?.name ?? "—"}
            sub={plan ? `${plan.price}/month` : "No active plan"}
            icon={CreditCard}
          />
        </div>

        {isMock && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
            Connect a database (Neon Postgres) and set <code className="text-primary">DATABASE_URL</code> to see real usage data.
            Mock data is currently shown for demonstration purposes.
          </div>
        )}
      </main>
    </>
  );
}
