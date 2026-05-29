/**
 * /solar/quotes — list all solar quotes for the org.
 * Server component: auth + product gate + data fetch.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listQuotes } from "@/lib/quoting-common/data/quotes";
import { listCustomers } from "@/lib/quoting-common/data/customers";
import { QuoteStatusBadge } from "@/components/quoting-common/QuoteStatusBadge";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offerter — Solar" };
export const dynamic = "force-dynamic";

export default async function SolarQuotesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "solar")) redirect("/app");

  const [quotes, customers] = await Promise.all([
    listQuotes(account.organization.id, { vertical: "solar" }),
    listCustomers(account.organization.id),
  ]);

  // Build a quick name lookup for customer ids
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between max-w-5xl">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold mb-1">
              Solar
            </p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Offerter</h1>
          </div>
          <Link
            href="/solar"
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            ← Översikt
          </Link>
        </div>
      </div>

      <main className="flex-1 px-6 py-6 max-w-5xl w-full">

        {quotes.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4 border border-white/[0.06]">
              <FileText size={20} className="text-white/30" />
            </div>
            <p className="text-sm font-medium text-white/70">Inga offerter ännu</p>
            <p className="text-xs text-white/40 mt-1">
              Skapa din första offert via API:et eller Solar-byggaren (kommer i S2).
            </p>
          </div>
        ) : (
          /* Quote table */
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Nummer</th>
                  <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Kund</th>
                  <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Totalt</th>
                  <th className="text-right text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Skapad</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q, i) => (
                  <tr
                    key={q.id}
                    className={i % 2 === 0 ? "bg-white/[0.015]" : ""}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white/80">
                      {q.number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {q.customerId ? (customerMap[q.customerId] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <QuoteStatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 tabular-nums">
                      {q.total
                        ? `${Number(q.total).toLocaleString("sv-SE")} kr`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/40 text-xs">
                      {new Date(q.createdAt).toLocaleDateString("sv-SE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
