/**
 * Public plan configuration used by both UI and server.
 * This file MUST NOT import 'stripe' (the node SDK) or any server-only secrets.
 *
 * This ensures that components like Pricing.tsx or the Dashboard Billing page
 * can render plan details (names, prices, features) without triggering
 * environment variable errors on the client.
 *
 * Annual pricing: 17% discount vs. paying month-to-month.
 *   Starter  €19/mån  → €189/år  (saves €39)
 *   Team     €49/mån  → €488/år  (saves €100)
 *   Business €99/mån  → €986/år  (saves €202)
 */

export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: "€19",
    /** Annual total in EUR */
    priceAnnual: "€189",
    /** Effective monthly cost when billed annually (189/12 ≈ 15.75) */
    priceMonthlyAnnual: "€15.75",
    /** Human-readable annual savings label */
    savingsLabel: "Spara €39/år",
    description: "For small teams testing AI email support",
    features: [
      "1 inbox",
      "2 users",
      "500 AI drafts/month",
      "Email categorization",
      "Basic templates"
    ],
    draftsLimit: 500,
    inboxLimit: 1,
    seatLimit: 2,
    ctaText: "Start with Starter",
    popular: false,
  },
  team: {
    id: "team",
    name: "Start as a Team",
    price: "€49",
    priceAnnual: "€488",
    priceMonthlyAnnual: "€40.67",
    savingsLabel: "Spara €100/år",
    description: "For companies handling customer emails every day",
    features: [
      "3 inboxes",
      "5 users",
      "2,000 AI drafts/month",
      "Thread summaries",
      "Company tone of voice",
      "Shared inbox",
      "Basic analytics"
    ],
    draftsLimit: 2000,
    inboxLimit: 3,
    seatLimit: 5,
    ctaText: "Start with Team",
    popular: true,
  },
  business: {
    id: "business",
    name: "Start as a Business",
    price: "€99",
    priceAnnual: "€986",
    priceMonthlyAnnual: "€82.17",
    savingsLabel: "Spara €202/år",
    description: "For growing teams with higher volume",
    features: [
      "5 inboxes",
      "10 users",
      "5,000 AI drafts/month",
      "Advanced workflows",
      "Knowledge base",
      "Access control",
      "Audit history"
    ],
    draftsLimit: 5000,
    inboxLimit: 5,
    seatLimit: 10,
    ctaText: "Start with Business",
    popular: false,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise / Corporate",
    price: "Custom",
    priceAnnual: "Custom",
    priceMonthlyAnnual: "Custom",
    savingsLabel: "",
    description: "Tailored AI solutions for large organizations",
    features: [
      "Custom AI workflows",
      "Multiple teams or departments",
      "Custom integration options",
      "Priority support",
      "Custom onboarding",
      "Custom billing",
      "Higher usage limits",
      "Tailored AI policy",
    ],
    draftsLimit: 999999,
    inboxLimit: 99,
    seatLimit: 999,
    ctaText: "Talk to sales",
    popular: false,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingPeriod = "monthly" | "annual";

/** List version for mapping in UI components */
export const PLAN_LIST = Object.values(PLANS);
