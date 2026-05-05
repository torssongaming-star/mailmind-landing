/**
 * Public plan configuration used by both UI and server.
 * This file MUST NOT import 'stripe' (the node SDK) or any server-only secrets.
 * 
 * This ensures that components like Pricing.tsx or the Dashboard Billing page
 * can render plan details (names, prices, features) without triggering 
 * environment variable errors on the client.
 */

export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: "€19",
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
    name: "Team",
    price: "€49",
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
    ctaText: "Book a demo",
    popular: true,
  },
  business: {
    id: "business",
    name: "Business",
    price: "€99",
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
    ctaText: "Talk to sales",
    popular: false,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** List version for mapping in UI components */
export const PLAN_LIST = Object.values(PLANS);
