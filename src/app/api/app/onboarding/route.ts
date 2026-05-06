/**
 * POST /api/app/onboarding
 *
 * Provisions the authenticated Clerk user in the Mailmind DB by creating an
 * organization (single-tenant for now — one org per user) and a `users` row.
 * Idempotent: if the user already exists, returns the existing record.
 *
 * This is the explicit "create my account" step shown after first login on
 * /app/onboarding. The brief specifies single-tenant for now (clerkOrgId = null).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncUserAndOrganization } from "@/lib/db/queries";
import { db, isDbConnected, subscriptions, licenseEntitlements, caseTypes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PLANS } from "@/lib/plans";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

/** Default case types seeded for new orgs so the AI has something to classify against. */
const DEFAULT_CASE_TYPES = [
  {
    slug:           "support",
    label:          "Supportärende",
    requiredFields: ["beskrivning"],
    sortOrder:      1,
    isDefault:      false,
  },
  {
    slug:           "fragor",
    label:          "Allmänna frågor",
    requiredFields: ["fragebeskrivning"],
    sortOrder:      2,
    isDefault:      false,
  },
  {
    slug:           "ovrigt",
    label:          "Övrigt",
    requiredFields: [],
    sortOrder:      99,
    isDefault:      true,
  },
];

/** 14-day trial on Starter plan when an org is first created. */
const TRIAL_DAYS = 14;

const Body = z.object({
  orgName: z.string().trim().min(1).max(120),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "Clerk user missing email" }, { status: 400 });
  }

  const result = await syncUserAndOrganization({
    clerkUserId: userId,
    email,
    clerkOrgId:  null, // single-tenant for now (briefen §3)
    orgName:     parsed.data.orgName,
  });

  if (!result) {
    // DB not connected — caller will see mock data instead. Still return 200
    // so the UI flow continues to /app where mock fallback kicks in.
    return NextResponse.json({ ok: true, mock: true });
  }

  const orgId = result.organizationId;

  // ── Bootstrap the new org with sensible defaults ────────────────────────────
  // Without these, a freshly-onboarded user lands on /app blocked by the
  // "no_subscription" gate. We seed:
  //   - 14-day trial on Starter (status=trialing → canUseApp=true)
  //   - License entitlements matching Starter limits
  //   - Three default case types so the AI has something to classify against
  //
  // All idempotent: re-running onboarding doesn't duplicate or break.
  if (isDbConnected()) {
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    // 1. Trial subscription. Skip if a subscription row already exists for this org.
    const existingSub = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .limit(1);

    if (existingSub.length === 0) {
      await db.insert(subscriptions).values({
        organizationId:       orgId,
        // Synthetic Stripe IDs — replaced when the user actually goes through checkout
        stripeSubscriptionId: `sub_trial_${orgId.slice(0, 8)}`,
        stripeCustomerId:     `cus_trial_${orgId.slice(0, 8)}`,
        plan:                 "starter",
        status:               "trialing",
        currentPeriodEnd:     trialEnd,
        cancelAtPeriodEnd:    false,
      });
    }

    // 2. License entitlements. Upsert so re-onboarding refreshes limits.
    const starter = PLANS.starter;
    await db
      .insert(licenseEntitlements)
      .values({
        organizationId:      orgId,
        plan:                "starter",
        maxUsers:            starter.seatLimit,
        maxInboxes:          starter.inboxLimit,
        maxAiDraftsPerMonth: starter.draftsLimit,
      })
      .onConflictDoUpdate({
        target: licenseEntitlements.organizationId,
        set: {
          plan:                "starter",
          maxUsers:            starter.seatLimit,
          maxInboxes:          starter.inboxLimit,
          maxAiDraftsPerMonth: starter.draftsLimit,
          updatedAt:           new Date(),
        },
      });

    // 3. Default case types — only if org has none yet.
    const existingTypes = await db
      .select({ id: caseTypes.id })
      .from(caseTypes)
      .where(eq(caseTypes.organizationId, orgId))
      .limit(1);

    if (existingTypes.length === 0) {
      await db.insert(caseTypes).values(
        DEFAULT_CASE_TYPES.map(ct => ({
          organizationId: orgId,
          slug:           ct.slug,
          label:          ct.label,
          requiredFields: ct.requiredFields,
          isDefault:      ct.isDefault,
          sortOrder:      ct.sortOrder,
        }))
      );
    }
  }

  await writeAuditLog({
    organizationId: orgId,
    userId:         result.user.id,
    action:         "onboarding_completed",
    metadata:       { orgName: parsed.data.orgName, email, trialDays: TRIAL_DAYS },
  });

  return NextResponse.json({
    ok: true,
    user: { id: result.user.id, email: result.user.email },
    organizationId: orgId,
    trial: { plan: "starter", days: TRIAL_DAYS },
  });
}
