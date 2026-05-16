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
import { getUserLocale } from "@/lib/i18n/get-locale";
import { getTranslations } from "@/lib/i18n";
import { Locale } from "@/lib/i18n/types";
import { AppBanners } from "./AppBanners";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const { userId } = await auth();
  const clerkUser = await currentUser();
  const locale = await getUserLocale();
  const { t } = getTranslations(locale);

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
        title={t("portal.dashboard.title")}
        description={t("portal.dashboard.description")}
      />
      <main className="flex-1 p-6 space-y-8">

      {/* Banner stack — single source of truth (trial/past-due/usage/deletion) */}
      <AppBanners account={account} />

      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {t("portal.dashboard.welcome")}{clerkUser.firstName ? `, ${clerkUser.firstName}` : ""}
          </h2>
          <p className="text-sm text-white/50 mt-1">
            {t("portal.dashboard.overview", { org: account.organization.name })}
          </p>
        </div>
        {account.isMock && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
            <Database size={12} />
            {t("portal.dashboard.previewMode")}
          </div>
        )}
      </div>

      {/* Getting-started — guided checklist with one active step at a time */}
      {!setupComplete && account.access.canUseApp && (
        <GettingStarted setup={setup} locale={locale} />
      )}

      {/* Plan + subscription */}
      <section className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm p-6">
        <h2 className="text-[10px] font-semibold text-white/45 uppercase tracking-widest mb-4">
          {t("portal.dashboard.subscription")}
        </h2>
        {plan ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-2xl font-bold text-white tracking-tight">{t(`plans.${plan.id}.name` as any)}</p>
                {account.subscription?.status && (
                  <StatusBadge status={account.subscription.status} locale={locale} />
                )}
              </div>
              <p className="text-sm text-white/55 mt-1">
                {plan.price}/{t("portal.dashboard.stats.plan").toLowerCase()}
              </p>
              {account.subscription?.currentPeriodEnd && (
                <p className="text-xs text-white/35 mt-2">
                  {account.subscription.cancelAtPeriodEnd ? t("portal.dashboard.cancelsOn") : t("portal.dashboard.renewsOn")}
                  {" "}
                  {new Date(account.subscription.currentPeriodEnd).toLocaleDateString(locale === "sv" ? "sv-SE" : "en-IE", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
            </div>
            <Link
              href="/dashboard/billing"
              className="shrink-0 inline-flex items-center h-8 px-3 rounded-lg border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors"
            >
              {t("portal.dashboard.manageBilling")}
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-white">{t("portal.dashboard.noActiveSub")}</p>
            <p className="text-xs text-white/45 mt-1">
              {t("portal.dashboard.choosePlan")}
            </p>
            <Link
              href="/dashboard/billing"
              className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-xs font-semibold hover:bg-cyan-300 transition-colors"
            >
              {t("portal.dashboard.viewPlans")}
            </Link>
          </div>
        )}
      </section>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={t("portal.dashboard.stats.aiDrafts")}
          value={`${(account.usage?.aiDraftsUsed ?? 0).toLocaleString()}`}
          icon={Zap}
          used={account.usage?.aiDraftsUsed ?? 0}
          limit={account.entitlements?.maxAiDraftsPerMonth ?? plan?.draftsLimit ?? 500}
          locale={locale}
        />
        <StatCard
          label={t("portal.dashboard.stats.inboxes")}
          value={`${inboxes.length} / ${account.entitlements?.maxInboxes ?? plan?.inboxLimit ?? 1}`}
          sub={t("portal.dashboard.stats.connectedInboxes")}
          icon={Mail}
          locale={locale}
        />
        <StatCard
          label={t("portal.dashboard.stats.seats")}
          value={`1 / ${account.entitlements?.maxUsers ?? plan?.seatLimit ?? 2}`}
          sub={t("portal.dashboard.stats.teamMembers")}
          icon={Users}
          locale={locale}
        />
        <StatCard
          label={t("portal.dashboard.stats.plan")}
          value={plan ? t(`plans.${plan.id}.name` as any) : "—"}
          sub={plan ? `${plan.price}/${t("portal.dashboard.stats.plan").toLowerCase()}` : t("portal.dashboard.stats.noPlan")}
          icon={CreditCard}
          locale={locale}
        />
      </div>

      {/* Quick actions — single primary CTA + secondary row */}
      {account.access.canUseApp && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/app/inbox"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.35)] hover:shadow-[0_6px_22px_-2px_hsl(189_94%_43%/0.5)] hover:bg-cyan-300 transition-all"
          >
            {t("portal.dashboard.quickActions.openInbox")} →
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/inboxes"
              className="inline-flex items-center h-11 px-4 rounded-xl border border-white/10 text-white/80 hover:text-white text-sm font-medium hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              {t("portal.dashboard.quickActions.connectInbox")}
            </Link>
            <Link
              href="/app/stats"
              className="inline-flex items-center h-11 px-4 rounded-xl border border-white/10 text-white/80 hover:text-white text-sm font-medium hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              {t("portal.dashboard.quickActions.stats")}
            </Link>
            <Link
              href="/app/settings"
              className="inline-flex items-center h-11 px-4 rounded-xl border border-white/10 text-white/80 hover:text-white text-sm font-medium hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              {t("portal.dashboard.quickActions.settings")}
            </Link>
          </div>
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

function GettingStarted({ setup, locale }: { setup: SetupState; locale: Locale }) {
  const { t } = getTranslations(locale);
  
  const GUIDED_STEPS: GuidedStep[] = [
    {
      key:   "accountReady",
      label: t("portal.onboarding.steps.account.label"),
      hint:  t("portal.onboarding.steps.account.hint"),
      href:  "/app",
      cta:   t("portal.onboarding.steps.account.cta"),
    },
    {
      key:   "inboxConnected",
      label: t("portal.onboarding.steps.inbox.label"),
      hint:  t("portal.onboarding.steps.inbox.hint"),
      href:  "/app/inboxes",
      cta:   t("portal.onboarding.steps.inbox.cta"),
    },
    {
      key:   "firstThread",
      label: t("portal.onboarding.steps.firstThread.label"),
      hint:  t("portal.onboarding.steps.firstThread.hint"),
      href:  "/app/inbox",
      cta:   t("portal.onboarding.steps.firstThread.cta"),
    },
    {
      key:   "caseTypeAdjustment",
      label: t("portal.onboarding.steps.caseTypes.label"),
      hint:  t("portal.onboarding.steps.caseTypes.hint"),
      href:  "/app/settings",
      cta:   t("portal.onboarding.steps.caseTypes.cta"),
    },
  ];

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
          <h2 className="text-base font-bold text-white">{t("portal.onboarding.title")}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {activeIdx === -1
              ? t("portal.onboarding.completed")
              : t("portal.onboarding.todo")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("portal.onboarding.progress")}</p>
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
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-normal">{t("portal.onboarding.optional")}</span>
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
                  {t("portal.onboarding.locked")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusBadge({ status, locale }: { status: string; locale: Locale }) {
  const { t } = getTranslations(locale);
  const map: Record<string, { label: string; cls: string }> = {
    active:     { label: t("portal.dashboard.subscriptionStatus.active"),     cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    trialing:   { label: t("portal.dashboard.subscriptionStatus.trialing"),   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    past_due:   { label: t("portal.dashboard.subscriptionStatus.past_due"),   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    cancelled:  { label: t("portal.dashboard.subscriptionStatus.cancelled"),  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    incomplete: { label: t("portal.dashboard.subscriptionStatus.incomplete"), cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    paused:     { label: t("portal.dashboard.subscriptionStatus.paused"),     cls: "bg-white/10 text-muted-foreground border-white/15" },
  };
  const v = map[status] ?? { label: status, cls: "bg-white/10 text-muted-foreground border-white/15" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${v.cls}`}>
      {v.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  used,
  limit,
  locale,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  used?: number;
  limit?: number;
  locale: Locale;
}) {
  const { t } = getTranslations(locale);
  const pct = used !== undefined && limit ? Math.round((used / limit) * 100) : null;
  const isWarning = pct !== null && pct >= 80;

  return (
    <div className="group rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm p-5 transition-colors duration-200 hover:border-white/12">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold text-white/45 uppercase tracking-widest">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center transition-colors duration-200 group-hover:bg-primary/15 group-hover:border-primary/25">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-0.5 tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
      {pct !== null && (
        <div className="mt-3">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isWarning ? "bg-amber-400" : "bg-gradient-to-r from-primary to-cyan-300"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className={`text-[10px] mt-1.5 tabular-nums ${isWarning ? "text-amber-400" : "text-white/40"}`}>
            {used?.toLocaleString()} / {limit?.toLocaleString()} {t("portal.dashboard.stats.used")}
          </p>
        </div>
      )}
    </div>
  );
}

