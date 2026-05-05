/**
 * GET /api/app/me
 *
 * Consolidated status endpoint for the app. Returns the same data the (app)
 * pages render server-side, so client components can refetch after billing
 * actions without page reloads.
 *
 * Authenticated by Clerk middleware (proxy.ts protects /api/app(.*)).
 *
 * Response shape mirrors the AccountSnapshot from lib/app/entitlements,
 * trimmed to only safe fields (no internal IDs, timestamps, or DB metadata
 * that the client doesn't need).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getCurrentAccount(userId);

  // Shape the response — only fields the client legitimately needs.
  return NextResponse.json({
    user: {
      id:    account.user?.id ?? null,
      email: account.user?.email ?? clerkUser.primaryEmailAddress?.emailAddress ?? null,
      role:  account.user?.role ?? null,
    },
    organization: {
      id:   account.organization.id,
      name: account.organization.name,
    },
    subscription: account.subscription
      ? {
          plan:               account.subscription.plan,
          status:             account.subscription.status,
          currentPeriodEnd:   account.subscription.currentPeriodEnd,
          cancelAtPeriodEnd:  account.subscription.cancelAtPeriodEnd,
        }
      : null,
    entitlements: account.entitlements
      ? {
          maxUsers:            account.entitlements.maxUsers,
          maxInboxes:          account.entitlements.maxInboxes,
          maxAiDraftsPerMonth: account.entitlements.maxAiDraftsPerMonth,
        }
      : null,
    usage: account.usage
      ? {
          aiDraftsUsed:    account.usage.aiDraftsUsed,
          emailsProcessed: account.usage.emailsProcessed,
          month:           account.usage.month,
        }
      : null,
    access: account.access,
    isMock: account.isMock,
  });
}
