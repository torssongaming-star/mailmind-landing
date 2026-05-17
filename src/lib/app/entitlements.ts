/**
 * App entitlement helpers — server-side only.
 *
 * Single source of truth for "may this user do X?" checks. All access decisions
 * in the Mailmind app must go through these functions; the client must NEVER
 * decide entitlement on its own.
 *
 * Data flow:
 *   Clerk userId → users.clerkUserId → organizations → subscription + entitlements + usage
 *
 * Mock fallback: if DATABASE_URL is unset, falls through to MOCK_PORTAL_DATA so
 * preview deployments stay functional.
 *
 * Status policy (briefly):
 *   active       → full access
 *   trialing     → full access
 *   past_due     → READ-only (canUseApp=true, canGenerateAiDraft=false)
 *   incomplete   → blocked (canUseApp=false)
 *   cancelled    → blocked
 *   paused       → blocked
 *   no sub       → blocked, redirect to /dashboard/billing
 */

import { getPortalData } from "@/lib/db/queries";
import { isDbConnected, db, inboxes, users as usersTable } from "@/lib/db";
import { eq, count } from "drizzle-orm";
import { PLANS, type PlanKey } from "@/lib/plans";
import type {
  Organization,
  User,
  Subscription,
  LicenseEntitlement,
  UsageCounter,
} from "@/lib/db/schema";

// ── Public types ──────────────────────────────────────────────────────────────

export type SubscriptionStatus = Subscription["status"];

/**
 * "What can this user do right now?" — the consolidated answer the app UI
 * and API routes consume. Always derived server-side.
 */
export type AccessState = {
  /** True if user can open the app at all (read existing data, see settings). */
  canUseApp: boolean;
  /** True if user can generate NEW AI drafts (gated by usage + status). */
  canGenerateAiDraft: boolean;
  /** True if user can add a new inbox (gated by entitlements + status). */
  canAddInbox: boolean;
  /** True if user can invite a new team member. */
  canInviteUser: boolean;
  /**
   * Machine-readable reason the user is blocked, if any. Use this to drive UI
   * messaging — never show this string directly without translation.
   */
  reason:
    | "ok"
    | "no_user"
    | "no_subscription"
    | "subscription_incomplete"
    | "subscription_cancelled"
    | "subscription_paused"
    | "past_due"
    | "ai_draft_limit_reached"
    | "inbox_limit_reached"
    | "user_limit_reached"
    | "deletion_pending";
};

/**
 * Full account snapshot — what the app needs after auth resolves.
 * Includes derived fields so callers don't have to reconstruct them.
 */
export type AccountSnapshot = {
  user: User | null;
  organization: Organization;
  subscription: Subscription | null;
  entitlements: LicenseEntitlement | null;
  usage: UsageCounter | null;
  /** Resolved plan config (limits, name, price) — null if no active sub. */
  plan: (typeof PLANS)[PlanKey] | null;
  /** True when reading from MOCK_PORTAL_DATA (no DB connection). */
  isMock: boolean;
  /** Convenience computed access state. */
  access: AccessState;
  /** Actual number of connected inboxes for this org (DB count). */
  inboxesUsed: number;
  /** Actual number of users in this org (DB count). */
  usersUsed: number;
};

// ── Core resolvers ────────────────────────────────────────────────────────────

/**
 * Get the full account snapshot for a Clerk user. The app's main entry helper —
 * one DB roundtrip (via getPortalData), then derive everything else.
 *
 * Returns `user: null` if the user has not yet been synced to the DB. Callers
 * should redirect to /app/onboarding in that case.
 */
export async function getCurrentAccount(
  clerkUserId: string
): Promise<AccountSnapshot> {
  const portal = await getPortalData(clerkUserId);

  // CRITICAL: getPortalData returns MOCK_PORTAL_DATA in two distinct cases:
  //   (A) DATABASE_URL not set                      → show mock everywhere
  //   (B) DB connected but user not yet synced      → user must onboard
  //
  // The portal helper marks both with `isMock: true`, so we use isDbConnected()
  // here to disambiguate. Case (B) is "real but empty" — we override the
  // account fields to null so the UI redirects to /app/onboarding.
  const dbConnected = isDbConnected();
  const userNotInDb = dbConnected && portal.isMock;

  const user         = userNotInDb ? null : portal.user;
  const subscription = userNotInDb ? null : portal.subscription;
  const entitlements = userNotInDb ? null : portal.entitlements;
  const usage        = userNotInDb ? null : portal.usage;

  // `isMock` in the snapshot now means "no DB at all" — Phase 2 callers can
  // trust it to mean "preview mode" rather than "user missing".
  const isMock = !dbConnected;

  // Determine plan config from active subscription, if any
  const planKey = subscription?.plan as PlanKey | undefined;
  const plan = planKey ? PLANS[planKey] : null;

  // Real usage counts — fix for strategi-revision P2.1 (fake hardcoded 0/1).
  // Run in parallel. Skip when DB unavailable or user not yet provisioned.
  let inboxesUsed = 0;
  let usersUsed   = 1;
  if (dbConnected && portal.org && !userNotInDb) {
    const [inboxRow, userRow] = await Promise.all([
      db.select({ c: count() }).from(inboxes).where(eq(inboxes.organizationId, portal.org.id)),
      db.select({ c: count() }).from(usersTable).where(eq(usersTable.organizationId, portal.org.id)),
    ]);
    inboxesUsed = Number(inboxRow[0]?.c ?? 0);
    usersUsed   = Number(userRow[0]?.c ?? 1);
  }

  // Compute access state from the (possibly nulled) snapshot
  const access = computeAccess({
    user,
    organization: portal.org,
    subscription,
    entitlements,
    usage,
    inboxesUsed,
    usersUsed,
  });

  return {
    user,
    organization: portal.org,
    subscription,
    entitlements,
    usage,
    plan,
    isMock,
    access,
    inboxesUsed,
    usersUsed,
  };
}

/**
 * Compute the AccessState from raw account data. Pure function — no I/O.
 * Exposed for unit testing and for callers who already hold the data.
 */
export function computeAccess(input: {
  user: User | null;
  organization?: Organization | null;
  subscription: Subscription | null;
  entitlements: LicenseEntitlement | null;
  usage: UsageCounter | null;
  /** REAL counts from DB. Falsy defaults are testing-only — never trust 0. */
  inboxesUsed?: number;
  usersUsed?: number;
}): AccessState {
  const { user, organization, subscription, entitlements, usage } = input;

  // 1. Not in DB at all → onboarding required
  if (!user) {
    return blocked("no_user");
  }

  // 1b. Org in deletion grace period → read-only, no writes
  if (organization?.deletionRequestedAt) {
    return {
      canUseApp:           true,
      canGenerateAiDraft:  false,
      canAddInbox:         false,
      canInviteUser:       false,
      reason:              "deletion_pending",
    };
  }

  // 2. No subscription → must purchase a plan
  if (!subscription) {
    return blocked("no_subscription");
  }

  // 3. Subscription status policy
  switch (subscription.status) {
    case "incomplete":
      return blocked("subscription_incomplete");
    case "cancelled":
      return blocked("subscription_cancelled");
    case "paused":
      return blocked("subscription_paused");
    case "past_due":
      return {
        canUseApp:           true,
        canGenerateAiDraft:  false,
        canAddInbox:         false,
        canInviteUser:       false,
        reason:              "past_due",
      };
    case "active":
    case "trialing":
      // fall through to limit checks
      break;
  }

  // 4. Limit checks (only relevant when status is active/trialing)
  const draftsUsed   = usage?.aiDraftsUsed ?? 0;
  const draftsLimit  = entitlements?.maxAiDraftsPerMonth ?? 0;
  const inboxLimit   = entitlements?.maxInboxes ?? 0;
  const userLimit    = entitlements?.maxUsers ?? 0;

  // Real counts injected from DB (strategi-revision P2.1 fix).
  // Defaults match "first user, no inboxes" — only safe for first-load callers.
  const inboxesUsed = input.inboxesUsed ?? 0;
  const usersUsed   = input.usersUsed   ?? 1;

  const canManageTeam = user.role === "owner" || user.role === "admin";

  return {
    canUseApp:           true,
    canGenerateAiDraft:  draftsUsed < draftsLimit,
    canAddInbox:         inboxesUsed < inboxLimit,
    canInviteUser:       canManageTeam && usersUsed < userLimit,
    reason: draftsUsed >= draftsLimit
      ? "ai_draft_limit_reached"
      : inboxesUsed >= inboxLimit
        ? "inbox_limit_reached"
        : usersUsed >= userLimit
          ? "user_limit_reached"
          : "ok",
  };
}

function blocked(reason: AccessState["reason"]): AccessState {
  return {
    canUseApp:           false,
    canGenerateAiDraft:  false,
    canAddInbox:         false,
    canInviteUser:       false,
    reason,
  };
}

// ── Convenience guards (server-side only) ─────────────────────────────────────

/**
 * Throws/returns false if the user cannot generate an AI draft right now.
 * Use BEFORE calling the AI provider — never after.
 *
 * Returns the snapshot when allowed so the caller doesn't refetch.
 */
export async function assertCanGenerateAiDraft(
  clerkUserId: string
): Promise<{ ok: true; account: AccountSnapshot } | { ok: false; reason: AccessState["reason"] }> {
  const account = await getCurrentAccount(clerkUserId);
  if (!account.access.canGenerateAiDraft) {
    return { ok: false, reason: account.access.reason };
  }
  return { ok: true, account };
}

/** Same pattern: check before INSERT into inboxes. */
export async function assertCanAddInbox(
  clerkUserId: string
): Promise<{ ok: true; account: AccountSnapshot } | { ok: false; reason: AccessState["reason"] }> {
  const account = await getCurrentAccount(clerkUserId);
  if (!account.access.canAddInbox) {
    return { ok: false, reason: account.access.reason };
  }
  return { ok: true, account };
}

/** Same pattern: check before sending an invite. */
export async function assertCanInviteUser(
  clerkUserId: string
): Promise<{ ok: true; account: AccountSnapshot } | { ok: false; reason: AccessState["reason"] }> {
  const account = await getCurrentAccount(clerkUserId);
  if (!account.access.canInviteUser) {
    return { ok: false, reason: account.access.reason };
  }
  return { ok: true, account };
}

/** Centralised role check (P4.2). Use everywhere instead of raw user.role. */
export function hasRole(
  account: AccountSnapshot,
  required: "owner" | "admin" | "member",
): boolean {
  const role = account.user?.role;
  if (!role) return false;
  if (required === "member") return true; // any role
  if (required === "admin")  return role === "owner" || role === "admin";
  if (required === "owner")  return role === "owner";
  return false;
}

/**
 * Returns just the entitlements row for an org, with mock fallback.
 * Useful for places that only need the limits (not subscription status).
 */
export async function getEntitlements(
  clerkUserId: string
): Promise<LicenseEntitlement | null> {
  const account = await getCurrentAccount(clerkUserId);
  return account.entitlements;
}

/**
 * Returns the current month's usage counter for the user's org.
 */
export async function getCurrentUsage(
  clerkUserId: string
): Promise<UsageCounter | null> {
  const account = await getCurrentAccount(clerkUserId);
  return account.usage;
}
