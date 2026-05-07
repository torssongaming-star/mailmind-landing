import { PlanKey } from "./plans";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Only throw in production server environments to allow builds to pass
  if (process.env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables.");
  }
}

/**
 * Singleton Stripe client (Server-only).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

/** Server-side Price ID map — sourced from environment variables */
export const PRICE_IDS = {
  starter:  process.env.STRIPE_PRICE_ID_STARTER  ?? "",
  team:     process.env.STRIPE_PRICE_ID_TEAM      ?? "",
  business: process.env.STRIPE_PRICE_ID_BUSINESS  ?? "",
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? "",
} as const;

/**
 * Look up which plan a Stripe price ID belongs to.
 * Returns null if the price ID doesn't match any known plan.
 */
export function getPlanFromPriceId(priceId: string): PlanKey | null {
  for (const [key, id] of Object.entries(PRICE_IDS)) {
    if (id === priceId) return key as PlanKey;
  }
  return null;
}

