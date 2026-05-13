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
import { listThreads, listInboxes, listCaseTypes } from "@/lib/app/threads";
import { PLANS } from "@/lib/plans";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { Zap, Mail, Users, CreditCard, Database } from "lucide-react";

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

  // Setup state for the getting-started checklist
  const [threads, inboxes, caseTypeRows] = await Promise.all([
    listThreads(account.organization.id, { limit: 1 }),
    listInboxes(account.organization.id),
    listCaseTypes(account.organization.id),
  ]);
  const setup = {
    accountReady:    !!account.user,
    inboxConnected:  inboxes.length > 0,
    caseTypesReady:  caseTypeRows.length > 0,
    firstThread:     threads.length > 0,
  };
  const setupComplete = Object.values(setup).every(Boolean);

  return (
    <>
      <DashboardHeader
        title="Home"
        description="Your plan and usage at a glance"
      />
      <main className="flex-1 p-6 space-y-8">

      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Welcome back{clerkUser.firstName ? `, ${clerkUser.firstName}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s an overview of your {account.organization.name} account.
          </p>
        </div>
        {account.isMock && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
            <Database size={12} />
            Preview Mode (Mock Data)
          </div>
        )}
      </div>

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

      {/* Getting-started — guided checklist with one active step at a time */}
      {!setupComplete && account.access.canUseApp && (
        <GettingStarted setup={setup} />
      )}

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

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="AI Drafts"
          value={`${(account.usage?.aiDraftsUsed ?? 0).toLocaleString()}`}
          icon={Zap}
          used={account.usage?.aiDraftsUsed ?? 0}
          limit={account.entitlements?.maxAiDraftsPerMonth ?? plan?.draftsLimit ?? 500}
        />
        <StatCard
          label="Inboxes"
          value={`${inboxes.length} / ${account.entitlements?.maxInboxes ?? plan?.inboxLimit ?? 1}`}
          sub="Connected inboxes"
          icon={Mail}
        />
        <StatCard
          label="Seats"
          value={`1 / ${account.entitlements?.maxUsers ?? plan?.seatLimit ?? 2}`}
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

      <section className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-6 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-white mb-2 text-sm">Status för din plan</p>
        <Row k="Du kan använda appen"            v={account.access.canUseApp ? "Ja" : "Nej"} />
        <Row k="Du kan generera AI-innehåll"    v={account.access.canGenerateAiDraft ? "Ja" : "Nej"} />
        <Row k="Du kan lägga till inkorgar"     v={account.access.canAddInbox ? "Ja" : "Nej"} />
        <Row k="Du har tillgång till team"       v={account.access.canInviteUser ? "Ja" : "Nej"} />
        <Row k="Statuskod"                       v={account.access.reason} />
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
            href="/app/stats"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Stats
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

type SetupState = {
  accountReady:   boolean;
  inboxConnected: boolean;
  caseTypesReady: boolean;
  firstThread:    boolean;
};

type GuidedStep = {
  key:   "accountReady" | "inboxConnected" | "firstThread" | "caseTypeAdjustment";
  label: string;
  hint:  string;
  href:  string;
  cta:   string;
};

const GUIDED_STEPS: GuidedStep[] = [
  {
    key:   "accountReady",
    label: "Konto skapat",
    hint:  "Välkommen ombord!",
    href:  "/app",
    cta:   "Klart",
  },
  {
    key:   "inboxConnected",
    label: "Anslut din första inkorg",
    hint:  "Vidarebefordra support@dittforetag.se till en Mailmind-adress — vi ger dig instruktioner.",
    href:  "/app/inboxes",
    cta:   "Anslut inkorg",
  },
  {
    key:   "firstThread",
    label: "Ta emot ditt första ärende",
    hint:  "Skicka ett testmejl till din nya inkorg-adress. Det dyker upp här inom 30 sekunder.",
    href:  "/app/inbox",
    cta:   "Öppna inkorg",
  },
  {
    key:   "caseTypeAdjustment",
    label: "Anpassa ärendetyper (valfritt)",
    hint:  "Vi har lagt in en grunduppsättning. Justera kategorier och SLA i inställningarna när du vill.",
    href:  "/app/settings",
    cta:   "Öppna inställningar",
  },
];

function GettingStarted({ setup }: { setup: SetupState }) {
  // Determine the active (first incomplete) step — only that one gets a CTA.
  const completed: Record<string, boolean> = {
    accountReady:       setup.accountReady,
    inboxConnected:     setup.inboxConnected,
    firstThread:        setup.firstThread,
    caseTypeAdjustment: setup.caseTypesReady, // optional, doesn't gate
  };
  const activeIdx = GUIDED_STEPS.findIndex((s, i) => {
    // Skip the optional case-types step when determining "next required action".
    if (s.key === "caseTypeAdjustment") return false;
    return !completed[s.key];
  });

  const doneCount = GUIDED_STEPS.filter(s => s.key !== "caseTypeAdjustment" && completed[s.key]).length;
  const totalCount = GUIDED_STEPS.filter(s => s.key !== "caseTypeAdjustment").length;

  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white">Kom igång med Mailmind</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {activeIdx === -1
              ? "Allt klart — välj en sak att justera nedan, eller börja triagera."
              : "Följ stegen så är du igång på under 5 minuter."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Framsteg</p>
          <p className="text-sm font-mono text-primary mt-0.5">{doneCount} / {totalCount}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {GUIDED_STEPS.map((s, i) => {
          const isDone     = completed[s.key];
          const isActive   = !isDone && i === activeIdx;
          const isOptional = s.key === "caseTypeAdjustment";
          const isLocked   = !isDone && !isActive && !isOptional;

          return (
            <li
              key={s.key as string}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                isActive
                  ? "bg-primary/10 border border-primary/40"
                  : isDone
                    ? "bg-white/[0.02] border border-white/5"
                    : isLocked
                      ? "bg-white/[0.02] border border-white/5 opacity-50"
                      : "bg-white/[0.02] border border-white/5"
              }`}
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold ${
                  isDone
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : isActive
                      ? "bg-primary text-[#030614] border-primary"
                      : "border-white/15 text-muted-foreground"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? "text-muted-foreground line-through" : "text-white"}`}>
                  {s.label}
                  {isOptional && !isDone && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-normal">valfritt</span>
                  )}
                </p>
                {(isActive || isOptional || (!isLocked && !isDone)) && (
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">{s.hint}</p>
                )}
              </div>
              {!isDone && (isActive || isOptional) && (
                <Link
                  href={s.href}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-primary text-[#030614] hover:bg-cyan-300"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {s.cta} →
                </Link>
              )}
              {isLocked && (
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  Låst
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
          </p>
        </div>
      )}
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
