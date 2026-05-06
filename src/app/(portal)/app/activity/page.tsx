/**
 * /app/activity — audit log viewer.
 *
 * Shows the most recent events for the current org. Useful for debugging
 * (which email triggered which AI draft, when usage limits hit, etc.) and
 * for compliance — every state change has a row.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getAuditLogs } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  ai_draft_generated:     { label: "AI draft generated",     tone: "blue" },
  ai_draft_edited:        { label: "Draft edited",           tone: "neutral" },
  ai_draft_sent:          { label: "Draft sent to customer", tone: "green" },
  ai_draft_rejected:      { label: "Draft rejected",         tone: "red" },
  thread_escalated:       { label: "Thread escalated",       tone: "amber" },
  thread_resolved:        { label: "Thread resolved",        tone: "green" },
  email_processed:        { label: "Email received",         tone: "blue" },
  inbox_connected:        { label: "Inbox connected",        tone: "green" },
  inbox_disconnected:     { label: "Inbox disconnected",     tone: "neutral" },
  user_invited:           { label: "User invited",           tone: "neutral" },
  user_removed:           { label: "User removed",           tone: "neutral" },
  onboarding_completed:   { label: "Account created",        tone: "green" },
  checkout_completed:     { label: "Subscription started",   tone: "green" },
  subscription_updated:   { label: "Subscription updated",   tone: "blue" },
  subscription_canceled:  { label: "Subscription cancelled", tone: "red" },
  payment_succeeded:      { label: "Payment succeeded",      tone: "green" },
  payment_failed:         { label: "Payment failed",         tone: "red" },
};

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

  const logs = await getAuditLogs(account.organization.id, 100);

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">

      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Activity</p>
          <h1 className="text-2xl font-bold text-white">Recent events</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Last {logs.length} events
          </p>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white px-3 py-1.5 transition-colors">
          ← App home
        </Link>
      </header>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-10 text-center">
          <p className="text-sm text-white/70">No activity yet</p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm divide-y divide-white/5 overflow-hidden">
          {logs.map(log => {
            const meta = ACTION_LABELS[log.action] ?? { label: log.action, tone: "neutral" };
            return (
              <li key={log.id} className="px-5 py-3 flex items-start gap-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${tonClasses(meta.tone)}`}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  {log.metadata != null && Object.keys(log.metadata as object).length > 0 && (
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer hover:text-white/70">
                        Details
                      </summary>
                      <pre className="text-[10px] text-white/50 mt-2 bg-black/30 p-2 rounded font-mono overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {new Date(log.createdAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
