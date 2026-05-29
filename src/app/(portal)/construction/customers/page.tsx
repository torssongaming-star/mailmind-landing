/**
 * /construction/customers — manage customers for the Construction workspace.
 * Reuses the shared CustomerManager island (vertical-agnostic).
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listCustomers } from "@/lib/quoting-common/data/customers";
import { CustomerManager } from "@/components/quoting-common/CustomerManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kunder — Construction" };
export const dynamic = "force-dynamic";

export default async function ConstructionCustomersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "construction")) redirect("/app");

  const customers = await listCustomers(account.organization!.id);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between max-w-5xl">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold mb-1">
              Construction
            </p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Kunder</h1>
          </div>
          <Link href="/construction" className="text-xs text-white/40 hover:text-white transition-colors">
            ← Översikt
          </Link>
        </div>
      </div>

      <main className="flex-1 px-6 py-6 max-w-5xl w-full">
        <CustomerManager initialCustomers={customers} vertical="construction" />
      </main>
    </div>
  );
}
