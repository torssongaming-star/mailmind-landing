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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API version mismatch in SDK types
  apiVersion: "2026-04-22.dahlia" as any,
  typescript: true,
});

/** Server-side Price ID map — sourced from environment variables */
export const PRICE_IDS = {
  starter:  process.env.STRIPE_PRICE_ID_STARTER  ?? "",
  team:     process.env.STRIPE_PRICE_ID_TEAM      ?? "",
  business: process.env.STRIPE_PRICE_ID_BUSINESS  ?? "",
} as const;

// Log configuration status (without leaking keys)
console.log("[stripe] Configuration:", {
  hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
  env: process.env.NODE_ENV,
  priceIds: Object.fromEntries(
    Object.entries(PRICE_IDS).map(([k, v]) => [k, v ? (v.startsWith("price_") ? "valid_format" : "invalid_format") : "missing"])
  )
});

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

