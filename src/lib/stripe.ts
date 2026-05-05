import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables.");
}

/**
 * Singleton Stripe client.
 * Uses the secret key from environment variables.
 * Compatible with both sk_* and rk_* (restricted) keys.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

/** Price ID map — sourced from environment variables */
export const PRICE_IDS = {
  starter:  process.env.STRIPE_PRICE_ID_STARTER  ?? "",
  team:     process.env.STRIPE_PRICE_ID_TEAM      ?? "",
  business: process.env.STRIPE_PRICE_ID_BUSINESS  ?? "",
} as const;

/** Plan metadata for display */
export const PLANS = {
  starter: {
    name: "Starter",
    price: "€19",
    priceId: () => PRICE_IDS.starter,
    draftsLimit: 500,
    inboxLimit: 1,
    seatLimit: 2,
  },
  team: {
    name: "Team",
    price: "€49",
    priceId: () => PRICE_IDS.team,
    draftsLimit: 2000,
    inboxLimit: 3,
    seatLimit: 5,
  },
  business: {
    name: "Business",
    price: "€99",
    priceId: () => PRICE_IDS.business,
    draftsLimit: 5000,
    inboxLimit: 5,
    seatLimit: 10,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Look up which plan a Stripe price ID belongs to.
 * Returns null if the price ID doesn't match any known plan.
 */
export function getPlanFromPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId() === priceId) return key as PlanKey;
  }
  return null;
}
