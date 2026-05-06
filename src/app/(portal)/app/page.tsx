/**
 * /app — Mailmind app home.
 *
 * Foundation-only UI for Step 2 of the integration brief. Shows:
 *   - account/org name
 *   - subscription plan + status
 *   - this month's usage (AI drafts, emails)
 *   - access state with appropriate banner (no sub / past due / limit reached)
 *
 * No AI, email, or inbox features yet — those come in Phase 2 once the
 * foundation is verified.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { PLANS } from "@/lib/plans";
import { DashboardHeader } from "@/components/portal/DashboardHeader";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser) {
    redirect("/login");
  }

  const account = await getCurrentAccount(userId);

  // User authenticated but not yet provisioned → onboarding
  if (!account.user) {
    redirect("/app/onboarding");
  }

  const planKey = account.subscription?.plan;
  const plan = planKey ? PLANS[planKey] : null;

  return (
    <>
      <DashboardHeader
        title="App"
        description={`Welcome back to ${account.organization.name}`}
      />
      <main className="flex-1 p-6 space-y-8">

      {/* Mock-data warning */}
      {account.isMock && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          <strong>Preview Mode</strong> — DATABASE_URL is not set. Showing mock data.
        </div>
      )}

      {/* Trial countdown */}
      <TrialBanner
        status={account.subscription?.status ?? null}
        currentPeriodEnd={account.subscription?.currentPeriodEnd ?? null}
      />

      {/* Access banner */}
      <AccessBanner reason={account.access.reason} />

      {/* Plan + subscription */}
      <section className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Subscription
        </h2>
        {plan ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-white">{plan.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.price}/month
                {account.subscription?.status && (
                  <> · <StatusBadge status={account.subscription.status} /></>
                )}
              </p>
              {account.subscription?.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-2">
                  {account.subscription.cancelAtPeriodEnd ? "Cancels on " : "Renews on "}
                  {new Date(account.subscription.currentPeriodEnd).toLocaleDateString("en-IE", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
            </div>
            <Link
              href="/dashboard/billing"
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors"
            >
              Manage billing
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-white">No active subscription</p>
            <p className="text-xs text-muted-foreground mt-1">
              Choose a plan to unlock the AI features.
            </p>
            <Link
              href="/dashboard/billing"
              className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors"
            >
              View plans
            </Link>
          </div>
        )}
      </section>

      {/* Usage */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UsageCard
          label="AI drafts this month"
          used={account.usage?.aiDraftsUsed ?? 0}
          limit={account.entitlements?.maxAiDraftsPerMonth ?? 0}
        />
        <UsageCard
          label="Inboxes"
          used={0}
          limit={account.entitlements?.maxInboxes ?? 0}
          sub="Connect inboxes coming soon"
        />
        <UsageCard
          label="Team members"
          used={1}
          limit={account.entitlements?.maxUsers ?? 0}
          sub="Invite team coming soon"
        />
      </section>

      {/* Access state debug card (server-side computed) */}
      <section className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-6 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-white mb-2 text-sm">Access state</p>
        <Row k="Can use app"            v={account.access.canUseApp} />
        <Row k="Can generate AI drafts" v={account.access.canGenerateAiDraft} />
        <Row k="Can add inbox"          v={account.access.canAddInbox} />
        <Row k="Can invite users"       v={account.access.canInviteUser} />
        <Row k="Reason"                 v={account.access.reason} />
      </section>

      {/* Quick actions */}
      {account.access.canUseApp && (
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/app/inbox"
            className="px-5 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Open inbox →
          </Link>
          <Link
            href="/app/inboxes"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Connect inbox
          </Link>
          <Link
            href="/app/settings"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Settings
          </Link>
          <Link
            href="/app/activity"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Activity
          </Link>
        </div>
      )}
    </main>
    </>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TrialBanner({
  status,
  currentPeriodEnd,
}: {
  status: string | null;
  currentPeriodEnd: Date | null;
}) {
  if (status !== "trialing" || !currentPeriodEnd) return null;
  const end = new Date(currentPeriodEnd);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const ending = daysLeft <= 3;

  return (
    <div className={`rounded-xl border px-5 py-3.5 flex items-center justify-between gap-4 ${
      ending
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-blue-500/20 bg-blue-500/5"
    }`}>
      <div>
        <p className={`text-sm font-semibold ${ending ? "text-amber-200" : "text-blue-200"}`}>
          {daysLeft === 0
            ? "Your trial ends today"
            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`}
        </p>
        <p className={`text-xs mt-0.5 ${ending ? "text-amber-200/70" : "text-blue-200/70"}`}>
          Trial ends {end.toLocaleDateString("en-IE", { month: "long", day: "numeric", year: "numeric" })}.
          Upgrade to continue using Mailmind without interruption.
        </p>
      </div>
      <Link
        href="/dashboard/billing"
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          ending
            ? "bg-amber-400 text-[#030614] hover:bg-amber-300"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        Upgrade
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:     { label: "Active",     cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    trialing:   { label: "Trial",      cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    past_due:   { label: "Past due",   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    cancelled:  { label: "Cancelled",  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    incomplete: { label: "Incomplete", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    paused:     { label: "Paused",     cls: "bg-white/10 text-muted-foreground border-white/15" },
  };
  const v = map[status] ?? { label: status, cls: "bg-white/10 text-muted-foreground border-white/15" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${v.cls}`}>
      {v.label}
    </span>
  );
}

function AccessBanner({ reason }: { reason: string }) {
  if (reason === "ok") return null;

  const messages: Record<string, { tone: "warn" | "block"; title: string; body: string; cta?: { label: string; href: string } }> = {
    no_subscription: {
      tone:  "block",
      title: "Subscription required",
      body:  "Choose a plan to start using Mailmind.",
      cta:   { label: "View plans", href: "/dashboard/billing" },
    },
    subscription_incomplete: {
      tone:  "block",
      title: "Payment incomplete",
      body:  "Your subscription is awaiting payment confirmation. Complete checkout to continue.",
      cta:   { label: "Resume checkout", href: "/dashboard/billing" },
    },
    subscription_cancelled: {
      tone:  "block",
      title: "Subscription cancelled",
      body:  "Your subscription has been cancelled. Reactivate to continue using Mailmind.",
      cta:   { label: "Reactivate", href: "/dashboard/billing" },
    },
    subscription_paused: {
      tone:  "block",
      title: "Subscription paused",
      body:  "Your subscription is paused. Resume billing to continue using Mailmind.",
      cta:   { label: "Manage billing", href: "/dashboard/billing" },
    },
    past_due: {
      tone:  "warn",
      title: "Payment past due",
      body:  "Update your card to keep generating AI drafts. Read access is still available.",
      cta:   { label: "Update payment", href: "/dashboard/billing" },
    },
    ai_draft_limit_reached: {
      tone:  "warn",
      title: "Monthly AI draft limit reached",
      body:  "Upgrade your plan to generate more drafts this month.",
      cta:   { label: "Upgrade plan", href: "/dashboard/billing" },
    },
  };

  const msg = messages[reason];
  if (!msg) return null;

  const cls = msg.tone === "block"
    ? "border-red-500/30 bg-red-500/5 text-red-200"
    : "border-amber-500/30 bg-amber-500/5 text-amber-200";

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${cls}`}>
      <div className="flex-1">
        <p className="font-semibold text-sm text-white">{msg.title}</p>
        <p className="text-xs mt-1 leading-relaxed">{msg.body}</p>
      </div>
      {msg.cta && (
        <Link
          href={msg.cta.href}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
        >
          {msg.cta.label}
        </Link>
      )}
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  sub,
}: {
  label: string;
  used: number;
  limit: number;
  sub?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const warn = pct >= 80;

  return (
    <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">{label}</p>
      <p className="text-2xl font-bold text-white">
        {used.toLocaleString()}
        <span className="text-sm font-normal text-muted-foreground"> / {limit.toLocaleString()}</span>
      </p>
      {limit > 0 && (
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
          <div
            className={`h-full rounded-full ${warn ? "bg-amber-400" : "bg-gradient-to-r from-primary to-cyan-300"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {sub && <p className="text-[10px] text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: boolean | string }) {
  return (
    <div className="flex justify-between font-mono">
      <span>{k}</span>
      <span className={typeof v === "boolean" ? (v ? "text-green-400" : "text-red-400") : "text-white"}>
        {String(v)}
      </span>
    </div>
  );
}
