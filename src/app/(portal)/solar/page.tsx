/**
 * /solar — Solar workspace dashboard.
 * Shows summary cards + quick navigation to quotes and customers.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sun, FileText, Users, BookOpen, ChevronRight } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listQuotes } from "@/lib/quoting-common/data/quotes";
import { listCustomers } from "@/lib/quoting-common/data/customers";
import { QuoteMetricsRow } from "@/components/quoting-common/QuoteMetricsRow";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Solar — Översikt" };
export const dynamic = "force-dynamic";

export default async function SolarPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "solar")) redirect("/app");

  const [quotes, customers] = await Promise.all([
    listQuotes(account.organization.id, { vertical: "solar" }),
    listCustomers(account.organization.id),
  ]);

  const activeQuotes = quotes.filter(
    (q) => !["rejected", "expired", "signed"].includes(q.status),
  ).length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Sun size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold">
              Workspace
            </p>
            <h1 className="text-lg font-semibold text-white leading-tight">Solar</h1>
          </div>
        </div>
      </div>

      <main className="flex-1 px-6 py-6 max-w-4xl w-full space-y-6">

        {/* KPIs */}
        <QuoteMetricsRow quotes={quotes} />

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/solar/quotes"
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-5 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-white/50 font-medium">Offerter</p>
                <p className="text-2xl font-bold text-white tabular-nums">{quotes.length}</p>
                {activeQuotes > 0 && (
                  <p className="text-[11px] text-primary/70 mt-0.5">
                    {activeQuotes} aktiva
                  </p>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
          </Link>

          <Link
            href="/solar/customers"
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-5 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Users size={16} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 font-medium">Kunder</p>
                <p className="text-2xl font-bold text-white tabular-nums">{customers.length}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
          </Link>

          <Link
            href="/solar/kb"
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-5 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 font-medium">Kunskapsbas</p>
                <p className="text-sm text-white/70 mt-0.5">Fakta för AI-offerter</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
          </Link>
        </div>

      </main>
    </div>
  );
}
