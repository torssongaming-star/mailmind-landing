/**
 * computeAccess() tests — strategi-revision P2.1.
 *
 * Validates that inbox/seat limits block exactly at limit + 1, that role
 * gating works for invites, and that subscription status overrides
 * limit checks (deletion_pending, past_due, etc.).
 *
 * computeAccess is the pure decision function — no I/O, easy to unit test.
 */

import { describe, it, expect } from "vitest";
import { computeAccess, hasRole, type AccountSnapshot } from "./entitlements";
import type {
  User,
  Organization,
  Subscription,
  LicenseEntitlement,
  UsageCounter,
} from "@/lib/db/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkUser(overrides: Partial<User> = {}): User {
  return {
    id:             "user-1",
    organizationId: "org-1",
    clerkUserId:    "clerk-1",
    email:          "owner@example.com",
    name:           "Owner",
    role:           "owner",
    createdAt:      new Date(),
    updatedAt:      new Date(),
    ...overrides,
  } as User;
}

function mkOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id:                    "org-1",
    name:                  "Acme",
    slug:                  "acme",
    stripeCustomerId:      null,
    createdAt:             new Date(),
    updatedAt:             new Date(),
    deletionRequestedAt:   null,
    ...overrides,
  } as Organization;
}

function mkSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id:                   "sub-1",
    organizationId:       "org-1",
    stripeSubscriptionId: "sub_stripe",
    plan:                 "team",
    status:               "active",
    trialEndsAt:          null,
    currentPeriodEnd:     new Date(Date.now() + 30 * 86400_000),
    cancelAtPeriodEnd:    false,
    createdAt:            new Date(),
    updatedAt:            new Date(),
    ...overrides,
  } as Subscription;
}

function mkEnt(overrides: Partial<LicenseEntitlement> = {}): LicenseEntitlement {
  return {
    id:                   "ent-1",
    organizationId:       "org-1",
    maxInboxes:           3,
    maxUsers:             5,
    maxAiDraftsPerMonth:  1000,
    autoSendEnabled:      false,
    createdAt:            new Date(),
    updatedAt:            new Date(),
    ...overrides,
  } as LicenseEntitlement;
}

function mkUsage(overrides: Partial<UsageCounter> = {}): UsageCounter {
  return {
    id:             "usage-1",
    organizationId: "org-1",
    periodMonth:    "2026-05",
    aiDraftsUsed:   0,
    autoSendsUsed:  0,
    createdAt:      new Date(),
    updatedAt:      new Date(),
    ...overrides,
  } as UsageCounter;
}

function baseInput(overrides: Partial<Parameters<typeof computeAccess>[0]> = {}): Parameters<typeof computeAccess>[0] {
  const defaults: Parameters<typeof computeAccess>[0] = {
    user:         mkUser(),
    organization: mkOrg(),
    subscription: mkSub(),
    entitlements: mkEnt(),
    usage:        mkUsage(),
    inboxesUsed:  0,
    usersUsed:    1,
  };
  return { ...defaults, ...overrides };
}

// ── Inbox limit ───────────────────────────────────────────────────────────────

describe("computeAccess — inbox limit", () => {
  it("allows when inboxesUsed < limit", () => {
    const a = computeAccess(baseInput({ inboxesUsed: 2 } as any));
    expect(a.canAddInbox).toBe(true);
  });

  it("allows at exactly limit - 1", () => {
    const a = computeAccess(baseInput({ inboxesUsed: 2 } as any)); // limit = 3
    expect(a.canAddInbox).toBe(true);
  });

  it("blocks at exactly limit (limit + 1 attempt)", () => {
    const a = computeAccess(baseInput({ inboxesUsed: 3 } as any)); // limit = 3 → 4th would exceed
    expect(a.canAddInbox).toBe(false);
    expect(a.reason).toBe("inbox_limit_reached");
  });

  it("blocks when over limit", () => {
    const a = computeAccess(baseInput({ inboxesUsed: 10 } as any));
    expect(a.canAddInbox).toBe(false);
    expect(a.reason).toBe("inbox_limit_reached");
  });

  it("blocks when entitlements null (limit = 0)", () => {
    const a = computeAccess(baseInput({ entitlements: null, inboxesUsed: 0 } as any));
    expect(a.canAddInbox).toBe(false);
  });
});

// ── User/seat limit ───────────────────────────────────────────────────────────

describe("computeAccess — user limit", () => {
  it("allows owner to invite when usersUsed < limit", () => {
    const a = computeAccess(baseInput({ usersUsed: 4 } as any)); // limit = 5
    expect(a.canInviteUser).toBe(true);
  });

  it("blocks at exactly limit (limit + 1 attempt)", () => {
    const a = computeAccess(baseInput({ usersUsed: 5 } as any));
    expect(a.canInviteUser).toBe(false);
    expect(a.reason).toBe("user_limit_reached");
  });

  it("blocks member role even under limit", () => {
    const a = computeAccess(baseInput({
      user:      mkUser({ role: "member" }),
      usersUsed: 1,
    } as any));
    expect(a.canInviteUser).toBe(false);
  });

  it("allows admin role under limit", () => {
    const a = computeAccess(baseInput({
      user:      mkUser({ role: "admin" }),
      usersUsed: 2,
    } as any));
    expect(a.canInviteUser).toBe(true);
  });
});

// ── Subscription status overrides ─────────────────────────────────────────────

describe("computeAccess — status policy", () => {
  it("deletion_pending blocks all writes but allows app use", () => {
    const a = computeAccess(baseInput({
      organization: mkOrg({ deletionRequestedAt: new Date() }),
    } as any));
    expect(a.canUseApp).toBe(true);
    expect(a.canAddInbox).toBe(false);
    expect(a.canInviteUser).toBe(false);
    expect(a.canGenerateAiDraft).toBe(false);
    expect(a.reason).toBe("deletion_pending");
  });

  it("past_due blocks writes but allows app use", () => {
    const a = computeAccess(baseInput({
      subscription: mkSub({ status: "past_due" }),
    } as any));
    expect(a.canUseApp).toBe(true);
    expect(a.canAddInbox).toBe(false);
    expect(a.canInviteUser).toBe(false);
    expect(a.canGenerateAiDraft).toBe(false);
    expect(a.reason).toBe("past_due");
  });

  it("cancelled blocks everything", () => {
    const a = computeAccess(baseInput({
      subscription: mkSub({ status: "cancelled" }),
    } as any));
    expect(a.canUseApp).toBe(false);
    expect(a.reason).toBe("subscription_cancelled");
  });

  it("no subscription → blocked", () => {
    const a = computeAccess(baseInput({ subscription: null } as any));
    expect(a.canUseApp).toBe(false);
    expect(a.reason).toBe("no_subscription");
  });

  it("no user → no_user", () => {
    const a = computeAccess(baseInput({ user: null } as any));
    expect(a.canUseApp).toBe(false);
    expect(a.reason).toBe("no_user");
  });

  it("trialing acts like active for limit checks", () => {
    const a = computeAccess(baseInput({
      subscription: mkSub({ status: "trialing" }),
      inboxesUsed:  2,
    } as any));
    expect(a.canAddInbox).toBe(true);
  });
});

// ── AI draft limit ────────────────────────────────────────────────────────────

describe("computeAccess — AI draft limit", () => {
  it("blocks at limit + 1 attempt", () => {
    const a = computeAccess(baseInput({
      usage: mkUsage({ aiDraftsUsed: 1000 }),
    } as any));
    expect(a.canGenerateAiDraft).toBe(false);
    expect(a.reason).toBe("ai_draft_limit_reached");
  });

  it("allows just under limit", () => {
    const a = computeAccess(baseInput({
      usage: mkUsage({ aiDraftsUsed: 999 }),
    } as any));
    expect(a.canGenerateAiDraft).toBe(true);
  });
});

// ── Role helper ───────────────────────────────────────────────────────────────

describe("hasRole", () => {
  const snap = (role: User["role"] | null): AccountSnapshot => ({
    user: role ? mkUser({ role }) : null,
  } as AccountSnapshot);

  it("owner satisfies owner", () => {
    expect(hasRole(snap("owner"), "owner")).toBe(true);
  });
  it("admin does not satisfy owner", () => {
    expect(hasRole(snap("admin"), "owner")).toBe(false);
  });
  it("admin satisfies admin", () => {
    expect(hasRole(snap("admin"), "admin")).toBe(true);
  });
  it("owner satisfies admin", () => {
    expect(hasRole(snap("owner"), "admin")).toBe(true);
  });
  it("member does not satisfy admin", () => {
    expect(hasRole(snap("member"), "admin")).toBe(false);
  });
  it("any role satisfies member", () => {
    expect(hasRole(snap("member"), "member")).toBe(true);
    expect(hasRole(snap("owner"),  "member")).toBe(true);
  });
  it("null user fails all checks", () => {
    expect(hasRole(snap(null), "member")).toBe(false);
  });
});
