import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Solar" };

export default async function SolarLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);

  if (!account.user) redirect("/app/onboarding");

  if (!hasProductAccess(account, "solar")) redirect("/app");

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Solar" description="Offertverktyg för solcellsinstallationer" />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
