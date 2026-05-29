import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Construction" };

export default async function ConstructionLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "construction")) redirect("/app");

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader title="Construction" description="Offertverktyg för byggprojekt" />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
