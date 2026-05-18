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
    /** Effective monthly cost when billed annually (189/12 ≈ 15.75, rounded) */
    priceMonthlyAnnual: "€16",
    /** Human-readable annual savings label */
    savingsLabel: "Spara €39/år",
    // ── Swedish kronor (SEK) ──────────────────────────────────────────────
    priceSEK:               "199 kr",
    priceAnnualSEK:         "1 999 kr",
    priceMonthlyAnnualSEK:  "167 kr",
    savingsLabelSEK:        "Spara 389 kr/år",
    description: "För småföretag som vill testa AI-e-postsupport",
    features: [
      "1 inkorg",
      "2 användare",
      "150 AI-utkast/mån",
      "Alla kärnfunktioner ingår",
      "E-postsupport",
    ],
    draftsLimit: 150,
    inboxLimit: 1,
    seatLimit: 2,
    ctaText: "Kom igång med Starter",
    popular: false,
  },
  team: {
    id: "team",
    name: "Start as a Team",
    price: "€49",
    priceAnnual: "€488",
    priceMonthlyAnnual: "€41",
    savingsLabel: "Spara €100/år",
    priceSEK:               "499 kr",
    priceAnnualSEK:         "5 299 kr",
    priceMonthlyAnnualSEK:  "442 kr",
    savingsLabelSEK:        "Spara 689 kr/år",
    description: "För företag som hanterar kundmejl dagligen",
    features: [
      "3 inkorgar",
      "5 användare",
      "1 500 AI-utkast/mån",
      "Alla kärnfunktioner ingår",
      "Delad inkorg & teamsamarbete",
      "Prioriterad e-postsupport",
    ],
    draftsLimit: 1500,
    inboxLimit: 3,
    seatLimit: 5,
    ctaText: "Kom igång med Team",
    popular: true,
  },
  business: {
    id: "business",
    name: "Start as a Business",
    price: "€99",
    priceAnnual: "€986",
    priceMonthlyAnnual: "€82",
    savingsLabel: "Spara €202/år",
    priceSEK:               "999 kr",
    priceAnnualSEK:         "11 499 kr",
    priceMonthlyAnnualSEK:  "958 kr",
    savingsLabelSEK:        "Spara 489 kr/år",
    description: "För växande team med högre volym",
    features: [
      "5 inkorgar",
      "10 användare",
      "5 000 AI-utkast/mån",
      "Alla kärnfunktioner ingår",
      "Webhooks & API-integration",
      "90 dagars granskningshistorik",
      "Telefonsupport",
    ],
    draftsLimit: 5000,
    inboxLimit: 5,
    seatLimit: 10,
    ctaText: "Kom igång med Business",
    popular: false,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise / Corporate",
    price: "Custom",
    priceAnnual: "Custom",
    priceMonthlyAnnual: "Custom",
    savingsLabel: "",
    priceSEK:               "Custom",
    priceAnnualSEK:         "Custom",
    priceMonthlyAnnualSEK:  "Custom",
    savingsLabelSEK:        "",
    description: "Skräddarsydda AI-lösningar för stora organisationer",
    features: [
      "Anpassade AI-arbetsflöden",
      "Flera team eller avdelningar",
      "Anpassade integrationer",
      "Prioriterad support",
      "Anpassad onboarding",
      "Anpassad fakturering",
      "Högre användningsgränser",
      "Skräddarsydd AI-policy",
    ],
    draftsLimit: 999999,
    inboxLimit: 99,
    seatLimit: 999,
    ctaText: "Kontakta oss",
    popular: false,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingPeriod = "monthly" | "annual";
export type Currency = "EUR" | "SEK";

/** List version for mapping in UI components */
export const PLAN_LIST = Object.values(PLANS);
