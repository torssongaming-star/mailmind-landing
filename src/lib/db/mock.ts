/**
 * Mock data for local development without a database connection.
 *
 * These values are returned by query helpers when DATABASE_URL is not set.
 * They intentionally show realistic numbers so the dashboard looks correct
 * during development and demos.
 *
 * Update freely — these never touch production.
 */

import type {
  Organization,
  User,
  Subscription,
  LicenseEntitlement,
  UsageCounter,
  AuditLog,
} from "./schema";

// ── Mock IDs (stable UUIDs so relations work consistently) ────────────────────

export const MOCK_ORG_ID    = "00000000-0000-0000-0000-000000000001";
export const MOCK_USER_ID   = "00000000-0000-0000-0000-000000000002";
export const MOCK_SUB_ID    = "00000000-0000-0000-0000-000000000003";

// ── Current month (first day) ─────────────────────────────────────────────────

const now = new Date();
const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  .toISOString()
  .slice(0, 10); // "YYYY-MM-01"

const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

// ── Mock records ──────────────────────────────────────────────────────────────

export const MOCK_ORGANIZATION: Organization = {
  id:               MOCK_ORG_ID,
  clerkOrgId:       null,
  name:             "Demo Organization",
  stripeCustomerId: null,
  createdAt:        new Date("2025-01-15T09:00:00Z"),
  updatedAt:        new Date(),
};

export const MOCK_USER: User = {
  id:             MOCK_USER_ID,
  clerkUserId:    "mock_clerk_user",
  organizationId: MOCK_ORG_ID,
  email:          "demo@mailmind.io",
  role:           "owner",
  createdAt:      new Date("2025-01-15T09:00:00Z"),
  updatedAt:      new Date(),
};

export const MOCK_SUBSCRIPTION: Subscription = {
  id:                   MOCK_SUB_ID,
  organizationId:       MOCK_ORG_ID,
  stripeSubscriptionId: "sub_mock_team_plan",
  stripeCustomerId:     "cus_mock_customer",
  plan:                 "team",
  status:               "active",
  currentPeriodEnd:     periodEnd,
  cancelAtPeriodEnd:    false,
  createdAt:            new Date("2025-01-15T09:00:00Z"),
  updatedAt:            new Date(),
};

export const MOCK_ENTITLEMENTS: LicenseEntitlement = {
  id:                  "00000000-0000-0000-0000-000000000004",
  organizationId:      MOCK_ORG_ID,
  plan:                "team",
  maxUsers:            5,
  maxInboxes:          3,
  maxAiDraftsPerMonth: 2000,
  createdAt:           new Date("2025-01-15T09:00:00Z"),
  updatedAt:           new Date(),
};

export const MOCK_USAGE: UsageCounter = {
  id:              "00000000-0000-0000-0000-000000000005",
  organizationId:  MOCK_ORG_ID,
  month:           firstOfMonth,
  aiDraftsUsed:    1247,
  emailsProcessed: 3891,
  createdAt:       new Date(),
  updatedAt:       new Date(),
};

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id:             "00000000-0000-0000-0000-000000000010",
    organizationId: MOCK_ORG_ID,
    userId:         MOCK_USER_ID,
    action:         "subscription_created",
    metadata:       { plan: "team", stripeSubscriptionId: "sub_mock_team_plan" },
    createdAt:      new Date("2025-01-15T09:00:00Z"),
  },
  {
    id:             "00000000-0000-0000-0000-000000000011",
    organizationId: MOCK_ORG_ID,
    userId:         MOCK_USER_ID,
    action:         "seat_added",
    metadata:       { email: "colleague@mailmind.io", role: "admin" },
    createdAt:      new Date("2025-02-03T14:22:00Z"),
  },
  {
    id:             "00000000-0000-0000-0000-000000000012",
    organizationId: MOCK_ORG_ID,
    userId:         null,
    action:         "invoice_paid",
    metadata:       { amount: 4900, currency: "eur", invoiceId: "in_mock_001" },
    createdAt:      new Date("2025-04-01T00:00:00Z"),
  },
];

// ── Convenience type for portal queries ──────────────────────────────────────

export type PortalData = {
  org:          Organization;
  user:         User | null;
  subscription: Subscription | null;
  entitlements: LicenseEntitlement | null;
  usage:        UsageCounter | null;
  isMock:       boolean;
};

export const MOCK_PORTAL_DATA: PortalData = {
  org:          MOCK_ORGANIZATION,
  user:         MOCK_USER,
  subscription: MOCK_SUBSCRIPTION,
  entitlements: MOCK_ENTITLEMENTS,
  usage:        MOCK_USAGE,
  isMock:       true,
};
