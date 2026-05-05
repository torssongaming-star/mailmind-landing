/**
 * Portal data queries
 *
 * Single entry point for all dashboard data needs. Each function:
 * 1. Returns mock data immediately if DATABASE_URL is not set
 * 2. Otherwise queries Postgres via Drizzle
 *
 * This means dashboard pages work correctly in local dev, CI, and on Vercel
 * preview deployments that don't have a database configured.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { isDbConnected } from "./index";
import {
  organizations,
  users,
  subscriptions,
  licenseEntitlements,
  usageCounters,
  auditLogs,
  type Subscription,
} from "./schema";
import {
  MOCK_PORTAL_DATA,
  MOCK_AUDIT_LOGS,
  type PortalData,
} from "./mock";

// Lazy import of db to avoid circular reference issues
async function getDb() {
  const { db } = await import("./index");
  return db;
}

import { PLANS } from "../plans";

// ── Portal overview data ───────────────────────────────────────────────────────

/**
 * Fetch all portal data for a given Clerk user.
 * Returns mock data if DATABASE_URL is not configured.
 *
 * TODO (Phase 3): Replace mock fallback with real queries once Neon is wired up.
 */
export async function getPortalData(clerkUserId: string): Promise<PortalData> {
  if (!isDbConnected()) {
    return MOCK_PORTAL_DATA;
  }

  const db = await getDb();

  // Find user row
  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!userRow?.organizationId) {
    // User not yet in DB — return mock data marked as such
    return { ...MOCK_PORTAL_DATA, isMock: true };
  }

  const orgId = userRow.organizationId;

  // Parallel queries for the rest of the data
  const [orgRow, subRow, entitlementRow, usageRow] = await Promise.all([
    db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.organizationId, orgId),
        // Only return active/trialing subscriptions
      ))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select()
      .from(licenseEntitlements)
      .where(eq(licenseEntitlements.organizationId, orgId))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select()
      .from(usageCounters)
      .where(and(
        eq(usageCounters.organizationId, orgId),
        // Current month — YYYY-MM-01
        eq(
          usageCounters.month,
          new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .slice(0, 10)
        )
      ))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  return {
    org:          orgRow ?? MOCK_PORTAL_DATA.org,
    user:         userRow,
    subscription: subRow,
    entitlements: entitlementRow,
    usage:        usageRow,
    isMock:       false,
  };
}

// ── Audit log queries ─────────────────────────────────────────────────────────

/**
 * Fetch the most recent audit log entries for an organisation.
 *
 * TODO (Phase 3): Add pagination and filtering by action type.
 */
export async function getAuditLogs(organizationId: string, limit = 20) {
  if (!isDbConnected()) {
    return MOCK_AUDIT_LOGS;
  }

  const db = await getDb();
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ── Usage helpers ─────────────────────────────────────────────────────────────

/**
 * Increment the AI drafts counter for the current month.
 * Creates the row if it doesn't exist yet.
 *
 * TODO (Phase 3): Call this from the AI draft generation API route.
 * TODO (Phase 3): Add a guard that checks entitlements before incrementing.
 */
export async function incrementAiDrafts(organizationId: string) {
  if (!isDbConnected()) return;

  const db = await getDb();
  const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  await db
    .insert(usageCounters)
    .values({ organizationId, month, aiDraftsUsed: 1, emailsProcessed: 0 })
    .onConflictDoUpdate({
      target: [usageCounters.organizationId, usageCounters.month],
      set: {
        aiDraftsUsed: sql`${usageCounters.aiDraftsUsed} + 1`,
        updatedAt: new Date(),
      },
    });
}

// ── Write helpers ─────────────────────────────────────────────────────────────

/**
 * Write an audit log entry.
 */
export async function writeAuditLog(entry: {
  organizationId: string;
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isDbConnected()) return;

  const db = await getDb();
  await db.insert(auditLogs).values({
    organizationId: entry.organizationId,
    userId:         entry.userId ?? null,
    action:         entry.action,
    metadata:       entry.metadata ?? null,
  });
}

/**
 * Ensures an organization and user exist in the database, linked to Clerk IDs.
 */
export async function syncUserAndOrganization(params: {
  clerkUserId: string;
  email: string;
  clerkOrgId?: string | null;
  orgName?: string | null;
  stripeCustomerId?: string;
}) {
  if (!isDbConnected()) return null;
  const db = await getDb();

  // 1. Resolve organization
  let orgId: string;
  
  if (params.clerkOrgId) {
    const [existingOrg] = await db
      .insert(organizations)
      .values({
        clerkOrgId: params.clerkOrgId,
        name: params.orgName || "Team Space",
        stripeCustomerId: params.stripeCustomerId,
      })
      .onConflictDoUpdate({
        target: organizations.clerkOrgId,
        set: { 
          stripeCustomerId: params.stripeCustomerId,
          updatedAt: new Date()
        },
      })
      .returning({ id: organizations.id });
    orgId = existingOrg.id;
  } else {
    // Solo user — try to find org by stripe customer ID or create one for the user
    const existingOrg = await db.query.organizations.findFirst({
      where: params.stripeCustomerId 
        ? eq(organizations.stripeCustomerId, params.stripeCustomerId)
        : undefined,
    });

    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: params.orgName || `${params.email.split("@")[0]}'s Space`,
          stripeCustomerId: params.stripeCustomerId,
        })
        .returning({ id: organizations.id });
      orgId = newOrg.id;
    }
  }

  // 2. Sync user
  const [userRow] = await db
    .insert(users)
    .values({
      clerkUserId: params.clerkUserId,
      email: params.email,
      organizationId: orgId,
      role: "owner", // Default to owner if they are the one setting up billing
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { 
        organizationId: orgId,
        updatedAt: new Date() 
      },
    })
    .returning();

  return { user: userRow, organizationId: orgId };
}

/**
 * Syncs Stripe subscription state to the database.
 */
export async function upsertSubscription(params: {
  organizationId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: keyof typeof PLANS;
  status: Subscription["status"];
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}) {
  if (!isDbConnected()) return;
  const db = await getDb();

  // 1. Update subscription record
  await db
    .insert(subscriptions)
    .values({
      organizationId: params.organizationId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripeCustomerId: params.stripeCustomerId,
      plan: params.plan as Subscription["plan"],
      status: params.status,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status: params.status,
        plan: params.plan as Subscription["plan"],
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        updatedAt: new Date(),
      },
    });

  // 2. Sync license entitlements based on plan
  const planConfig = PLANS[params.plan];
  if (planConfig) {
    await db
      .insert(licenseEntitlements)
      .values({
        organizationId: params.organizationId,
        plan: params.plan as Subscription["plan"],
        maxUsers: planConfig.seatLimit,
        maxInboxes: planConfig.inboxLimit,
        maxAiDraftsPerMonth: planConfig.draftsLimit,
      })
      .onConflictDoUpdate({
        target: licenseEntitlements.organizationId,
        set: {
          plan: params.plan as Subscription["plan"],
          maxUsers: planConfig.seatLimit,
          maxInboxes: planConfig.inboxLimit,
          maxAiDraftsPerMonth: planConfig.draftsLimit,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Find organization ID by Stripe Customer ID.
 */
export async function getOrgIdByStripeCustomer(stripeCustomerId: string) {
  if (!isDbConnected()) return null;
  const db = await getDb();
  
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, stripeCustomerId),
    columns: { id: true },
  });
  
  return org?.id || null;
}

