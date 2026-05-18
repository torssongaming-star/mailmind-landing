import { PlanKey, BillingPeriod } from "./plans";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY is not set in environment variables.");
}

/**
 * Singleton Stripe client (Server-only).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API version mismatch in SDK types
  apiVersion: "2026-04-22.dahlia" as any,
  typescript: true,
});

/**
 * Server-side Price ID map — sourced from environment variables.
 * Each plan has a monthly and an annual price ID.
 * Annual env vars: STRIPE_PRICE_ID_<PLAN>_ANNUAL
 */
export const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_ID_STARTER         ?? "",
    annual:  process.env.STRIPE_PRICE_ID_STARTER_ANNUAL  ?? "",
  },
  team: {
    monthly: process.env.STRIPE_PRICE_ID_TEAM            ?? "",
    annual:  process.env.STRIPE_PRICE_ID_TEAM_ANNUAL     ?? "",
  },
  business: {
    monthly: process.env.STRIPE_PRICE_ID_BUSINESS        ?? "",
    annual:  process.env.STRIPE_PRICE_ID_BUSINESS_ANNUAL ?? "",
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ID_ENTERPRISE      ?? "", // Optional — contact sales plan
    annual:  "",
  },
};

// Log configuration status in development only (without leaking keys)
if (process.env.NODE_ENV !== "production") {
  console.log("[stripe] Configuration:", {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    env: process.env.NODE_ENV,
    priceIds: Object.fromEntries(
      Object.entries(PRICE_IDS).map(([k, v]) => [
        k,
        {
          monthly: v.monthly ? (v.monthly.startsWith("price_") ? "valid_format" : "invalid_format") : "missing",
          annual:  v.annual  ? (v.annual.startsWith("price_")  ? "valid_format" : "invalid_format") : "missing",
        },
      ])
    ),
  });
}

/**
 * Look up which plan and billing period a Stripe price ID belongs to.
 * Returns null if the price ID doesn't match any known plan.
 */
export function getPlanFromPriceId(
  priceId: string,
): { plan: PlanKey; billingPeriod: BillingPeriod } | null {
  for (const [key, ids] of Object.entries(PRICE_IDS)) {
    if (ids.monthly && ids.monthly === priceId) {
      return { plan: key as PlanKey, billingPeriod: "monthly" };
    }
    if (ids.annual && ids.annual === priceId) {
      return { plan: key as PlanKey, billingPeriod: "annual" };
    }
  }
  return null;
}

