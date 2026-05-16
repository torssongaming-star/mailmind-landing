/**
 * Sidebar subscription badge — small persistent indicator at the bottom
 * of the sidebar. Server component (auths via Clerk + reads account snapshot).
 *
 * States (in priority order):
 *   - Deletion-pending: red countdown
 *   - Past-due:         red "Update card"
 *   - Trialing:         primary "N days left" (amber when <= 3)
 *   - Active:           hide
 */

import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";
import { getCurrentAccount } from "@/lib/app/entitlements";

export async function SidebarSubscriptionBadge() {
  const { userId } = await auth();
  if (!userId) return null;

  let account;
  try {
    account = await getCurrentAccount(userId);
  } catch {
    return null;
  }
  if (!account.user) return null;

  // Deletion pending — show countdown
  if (account.organization?.deletionRequestedAt) {
    const purgeAt = new Date(
      new Date(account.organization.deletionRequestedAt).getTime() + 30 * 24 * 3600 * 1000,
    );
    const daysLeft = Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 3600 * 1000)));
    return (
      <Link
        href="/app/settings/account"
        className="flex items-center gap-2 mx-3 my-2 px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/[0.08] transition-colors"
      >
        <AlertTriangle size={14} className="text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-red-200 leading-tight">Radering pågår</p>
          <p className="text-[10px] text-red-300/70 leading-tight mt-0.5">{daysLeft} dag{daysLeft !== 1 ? "ar" : ""} kvar</p>
        </div>
      </Link>
    );
  }

  const sub = account.subscription;
  if (!sub) return null;

  if (sub.status === "past_due") {
    return (
      <Link
        href="/dashboard/billing"
        className="flex items-center gap-2 mx-3 my-2 px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/[0.08] transition-colors"
      >
        <AlertTriangle size={14} className="text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-red-200 leading-tight">Betalning misslyckades</p>
          <p className="text-[10px] text-red-300/70 leading-tight mt-0.5">Uppdatera kort →</p>
        </div>
      </Link>
    );
  }

  if (sub.status === "trialing") {
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (24 * 3600 * 1000)
    ));
    const urgent = daysLeft <= 3;
    return (
      <Link
        href="/dashboard/billing"
        className={[
          "flex items-center gap-2 mx-3 my-2 px-3 py-2 rounded-xl border transition-colors",
          urgent
            ? "border-amber-500/30 bg-amber-500/[0.05] hover:bg-amber-500/[0.1]"
            : "border-primary/25 bg-primary/[0.04] hover:bg-primary/[0.08]",
        ].join(" ")}
      >
        <Clock size={14} className={urgent ? "text-amber-400 shrink-0" : "text-primary shrink-0"} />
        <div className="flex-1 min-w-0">
          <p className={[
            "text-[11px] font-semibold leading-tight",
            urgent ? "text-amber-200" : "text-white",
          ].join(" ")}>
            {daysLeft === 0 ? "Trial slut idag" : `Trial · ${daysLeft}d kvar`}
          </p>
          <p className={[
            "text-[10px] leading-tight mt-0.5",
            urgent ? "text-amber-300/70" : "text-white/40",
          ].join(" ")}>
            {urgent ? "Lägg till kort →" : "Hantera abonnemang"}
          </p>
        </div>
      </Link>
    );
  }

  return null;
}
