import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listMembers, listPendingInvites } from "@/lib/app/team";
import { TeamPage } from "./TeamPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Team" };

export const dynamic = "force-dynamic";

export default async function TeamRoute() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const [members, invites] = await Promise.all([
    listMembers(account.organization.id),
    listPendingInvites(account.organization.id),
  ]);

  const seatLimit = account.entitlements?.maxUsers ?? 5;

  return (
    <TeamPage
      initialMembers={members.map(m => ({
        id:        m.id,
        email:     m.email,
        role:      m.role,
        createdAt: m.createdAt,
      }))}
      initialInvites={invites.map(i => ({
        id:        i.id,
        email:     i.email,
        role:      i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      }))}
      currentUserId={account.user.id}
      currentUserRole={account.user.role}
      seatLimit={seatLimit}
      orgName={account.organization.name}
    />
  );
}
