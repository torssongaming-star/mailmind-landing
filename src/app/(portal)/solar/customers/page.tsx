/**
 * /solar/customers — list all customers for the org.
 * Server component: auth + product gate + data fetch.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listCustomers } from "@/lib/quoting-common/data/customers";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kunder — Solar" };
export const dynamic = "force-dynamic";

export default async function SolarCustomersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "solar")) redirect("/app");

  const customers = await listCustomers(account.organization.id);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between max-w-5xl">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold mb-1">
              Solar
            </p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Kunder</h1>
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

        {customers.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4 border border-white/[0.06]">
              <Users size={20} className="text-white/30" />
            </div>
            <p className="text-sm font-medium text-white/70">Inga kunder ännu</p>
            <p className="text-xs text-white/40 mt-1">
              Lägg till kunder via API:et eller kundformulär (kommer i S2).
            </p>
          </div>
        ) : (
          /* Customer table */
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Namn</th>
                  <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Org.nr</th>
                  <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">E-post</th>
                  <th className="text-right text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Skapad</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr
                    key={c.id}
                    className={i % 2 === 0 ? "bg-white/[0.015]" : ""}
                  >
                    <td className="px-4 py-3 text-white/80 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-white/50 font-mono text-xs">
                      {c.orgNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-white/40 text-xs">
                      {new Date(c.createdAt).toLocaleDateString("sv-SE")}
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
