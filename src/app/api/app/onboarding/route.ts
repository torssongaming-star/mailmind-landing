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
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncUserAndOrganization } from "@/lib/db/queries";
import { db, isDbConnected, licenseEntitlements, caseTypes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PLANS } from "@/lib/plans";
import { writeAuditLog } from "@/lib/app/audit";
import { trackEvent, identifyUser, groupOrg } from "@/lib/analytics";

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
  // Seeds licence entitlements and default case types. The trial subscription
  // is created by Stripe when the user completes checkout (trial_period_days: 14).
  // All idempotent: re-running onboarding doesn't duplicate or break.
  if (isDbConnected()) {
    // 1. License entitlements. Upsert so re-onboarding refreshes limits.
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

  // Analytics — fire-and-forget, non-blocking (GDPR: no email/name, only IDs)
  await Promise.all([
    trackEvent({
      distinctId:  userId,
      event:       "signup.completed",
      properties:  { method: "email", org_id: orgId },
      groups:      { organization: orgId },
    }),
    trackEvent({
      distinctId:  userId,
      event:       "trial_started",
      properties:  { org_id: orgId, plan: "starter" },
      groups:      { organization: orgId },
    }),
    identifyUser(userId, { orgId, plan: "starter" }),
    groupOrg(orgId, { plan: "starter", status: "trialing", createdAt: new Date().toISOString() }),
  ]);

  // Mark step 1 done in Clerk metadata so onboarding page can resume correctly
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { onboardingStep: "website" },
  });

  return NextResponse.json({
    ok: true,
    user: { id: result.user.id, email: result.user.email },
    organizationId: orgId,
    trial: { plan: "starter", days: TRIAL_DAYS },
  });
}

// ── PATCH — update onboarding progress ────────────────────────────────────────

const VALID_STEPS = ["workspace", "website", "casetypes", "aibehavior", "webhooks", "done"] as const;
const PatchBody = z.object({
  step: z.enum(VALID_STEPS),
});

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      onboardingStep: parsed.data.step,
      ...(parsed.data.step === "done" ? { onboardingDone: true } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
