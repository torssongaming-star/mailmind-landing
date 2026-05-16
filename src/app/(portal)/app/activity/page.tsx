import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getAuditLogs } from "@/lib/db/queries";
import { getTranslations } from "@/lib/i18n";
import { getUserLocale } from "@/lib/i18n/get-locale";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Aktivitet" };

export const dynamic = "force-dynamic";

function tonClasses(tone: string): string {
  switch (tone) {
    case "green":  return "bg-green-500/15 text-green-400 border-green-500/30";
    case "blue":   return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "amber":  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "red":    return "bg-red-500/15 text-red-400 border-red-500/30";
    default:       return "bg-white/10 text-muted-foreground border-white/15";
  }
}

export default async function ActivityPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const locale = await getUserLocale();
  const { t } = getTranslations(locale);

  const logs = await getAuditLogs(account.organization.id, 100);

  const ACTION_MAP: Record<string, { label: string; tone: string }> = {
    ai_draft_generated:     { label: t("portal.activity.actions.ai_draft_generated"),     tone: "blue" },
    ai_draft_skipped:       { label: t("portal.activity.actions.ai_draft_skipped"),       tone: "neutral" },
    ai_draft_edited:        { label: t("portal.activity.actions.ai_draft_edited"),        tone: "neutral" },
    ai_draft_sent:          { label: t("portal.activity.actions.ai_draft_sent"),          tone: "green" },
    ai_draft_rejected:      { label: t("portal.activity.actions.ai_draft_rejected"),      tone: "red" },
    thread_escalated:       { label: t("portal.activity.actions.thread_escalated"),       tone: "amber" },
    thread_resolved:        { label: t("portal.activity.actions.thread_resolved"),        tone: "green" },
    email_processed:        { label: t("portal.activity.actions.email_processed"),        tone: "blue" },
    inbox_connected:        { label: t("portal.activity.actions.inbox_connected"),        tone: "green" },
    inbox_disconnected:     { label: t("portal.activity.actions.inbox_disconnected"),     tone: "neutral" },
    user_invited:           { label: t("portal.activity.actions.user_invited"),           tone: "neutral" },
    user_removed:           { label: t("portal.activity.actions.user_removed"),           tone: "neutral" },
    onboarding_completed:   { label: t("portal.activity.actions.onboarding_completed"),   tone: "green" },
    checkout_completed:     { label: t("portal.activity.actions.checkout_completed"),     tone: "green" },
    subscription_updated:   { label: t("portal.activity.actions.subscription_updated"),   tone: "blue" },
    subscription_canceled:  { label: t("portal.activity.actions.subscription_canceled"),  tone: "red" },
    payment_succeeded:      { label: t("portal.activity.actions.payment_succeeded"),      tone: "green" },
    payment_failed:         { label: t("portal.activity.actions.payment_failed"),         tone: "red" },
  };

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">

      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">{t("portal.activity.header")}</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t("portal.activity.title")}</h1>
          <p className="text-sm text-white/50 mt-1 tabular-nums">
            {t("portal.activity.lastEvents", { count: logs.length.toString() })}
          </p>
        </div>
        <Link
          href="/app"
          className="shrink-0 inline-flex items-center h-8 text-xs text-white/55 hover:text-white px-3 rounded-lg hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          ← {t("nav.app")}
        </Link>
      </header>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-10 text-center">
          <p className="text-sm text-white/70">{t("portal.activity.noActivity")}</p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm divide-y divide-white/5 overflow-hidden">
          {logs.map(log => {
            const meta = ACTION_MAP[log.action] ?? { label: log.action, tone: "neutral" };
            return (
              <li key={log.id} className="px-5 py-3 flex items-start gap-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${tonClasses(meta.tone)}`}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  {log.metadata != null && Object.keys(log.metadata as object).length > 0 && (
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer hover:text-white/70">
                        {t("portal.activity.details")}
                      </summary>
                      <pre className="text-[10px] text-white/50 mt-2 bg-black/30 p-2 rounded font-mono overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {new Date(log.createdAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
