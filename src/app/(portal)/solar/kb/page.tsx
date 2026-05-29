/**
 * /solar/kb — Knowledge-base management for the Solar workspace.
 *
 * Server component: auth + product gate + initial fetch. Renders the KbManager
 * client island. Members can view; owners/admins can mutate (enforced server-
 * side in the API, mirrored in the UI via canManage).
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { hasOrgAdminRole } from "@/lib/app/rbac";
import { listKbEntries } from "@/lib/quoting-common/data/kb";
import { KbManager } from "@/components/solar/KbManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kunskapsbas — Solar" };
export const dynamic = "force-dynamic";

export default async function SolarKbPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "solar")) redirect("/app");

  const entries = await listKbEntries(account.organization!.id, { vertical: "solar" });
  const canManage = hasOrgAdminRole(account);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between max-w-3xl">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-semibold mb-1">
              Solar
            </p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Kunskapsbas</h1>
            <p className="text-xs text-white/45 mt-1 max-w-md leading-relaxed">
              Fakta som AI:n grundar offerter på. Endast kundvända poster når
              kunden — interna poster blockeras av egress-grinden.
            </p>
          </div>
          <Link
            href="/solar"
            className="text-xs text-white/40 hover:text-white transition-colors shrink-0"
          >
            ← Översikt
          </Link>
        </div>
      </div>

      <main className="flex-1 px-6 py-6 max-w-3xl w-full">
        <KbManager initialEntries={entries} canManage={canManage} />
      </main>
    </div>
  );
}
