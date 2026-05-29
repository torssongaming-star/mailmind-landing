/**
 * /construction — Construction workspace dashboard.
 *
 * Proves the multi-vertical kernel: this vertical reuses the entire
 * quoting-common stack (quotes, customers, KB, AI authoring, egress) with
 * its own engine. Summary cards + nav to quotes and knowledge base.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HardHat, FileText, BookOpen, Users, ChevronRight } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listQuotes } from "@/lib/quoting-common/data/quotes";
import { QuoteMetricsRow } from "@/components/quoting-common/QuoteMetricsRow";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Construction — Översikt" };
export const dynamic = "force-dynamic";

export default async function ConstructionPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "construction")) redirect("/app");

  const quotes = await listQuotes(account.organization!.id, { vertical: "construction" });
  const activeQuotes = quotes.filter(
    (q) => !["rejected", "expired", "signed"].includes(q.status),
  ).length;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <HardHat size={18} className="text-orange-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold">
              Workspace
            </p>
            <h1 className="text-lg font-semibold text-white leading-tight">Construction</h1>
          </div>
        </div>
      </div>

      <main className="flex-1 px-6 py-6 max-w-4xl w-full space-y-6">
        <QuoteMetricsRow quotes={quotes} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/construction/quotes"
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
                  <p className="text-[11px] text-primary/70 mt-0.5">{activeQuotes} aktiva</p>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
          </Link>

          <Link
            href="/construction/customers"
            className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-5 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Users size={16} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 font-medium">Kunder</p>
                <p className="text-sm text-white/70 mt-0.5">Hantera kunder</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
          </Link>

          <Link
            href="/construction/kb"
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

        <div className="rounded-2xl border border-white/[0.06] bg-primary/[0.03] px-5 py-4">
          <p className="text-xs font-semibold text-primary/70 mb-1">Multi-vertikal kärna</p>
          <p className="text-sm text-white/60 leading-relaxed">
            Construction delar hela quoting-common-stacken med Solar — offerter,
            kunder, kunskapsbas, AI-författarlager och egress-grind. Endast
            beräkningsmotorn är vertikal-specifik.
          </p>
        </div>
      </main>
    </div>
  );
}
