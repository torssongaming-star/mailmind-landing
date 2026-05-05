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
import { isDbConnected } from "@/lib/db";
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
    | "user_limit_reached";
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

  // Compute access state from the (possibly nulled) snapshot
  const access = computeAccess({
    user,
    subscription,
    entitlements,
    usage,
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
  };
}

/**
 * Compute the AccessState from raw account data. Pure function — no I/O.
 * Exposed for unit testing and for callers who already hold the data.
 */
export function computeAccess(input: {
  user: User | null;
  subscription: Subscription | null;
  entitlements: LicenseEntitlement | null;
  usage: UsageCounter | null;
}): AccessState {
  const { user, subscription, entitlements, usage } = input;

  // 1. Not in DB at all → onboarding required
  if (!user) {
    return blocked("no_user");
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

  // We don't track inboxes/users used yet (Phase 2 features) — the helpers
  // accept `inboxesUsed`/`usersUsed` parameters when those tables exist.
  // For now, default to 0 used → always allowed within limit.
  const inboxesUsed = 0;
  const usersUsed   = 1; // current user themselves

  return {
    canUseApp:           true,
    canGenerateAiDraft:  draftsUsed < draftsLimit,
    canAddInbox:         inboxesUsed < inboxLimit,
    canInviteUser:       usersUsed < userLimit,
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
