/**
 * Platform health checks — shared between the public API endpoint
 * (`/api/admin/health`, secret-gated) and the admin UI page (`/admin/health`,
 * Clerk-gated).
 *
 * Each check returns a status: "ok" | "warn" | "fail" plus an optional detail
 * string for human consumption.
 */

import { sql } from "drizzle-orm";
import { db, isDbConnected } from "@/lib/db";
import { z } from "zod";

export type HealthStatus = "ok" | "warn" | "fail";

export type HealthCheck = {
  name:    string;
  status:  HealthStatus;
  detail?: string;
};

export type HealthReport = {
  overall: HealthStatus;
  summary: { ok: number; warn: number; fail: number };
  checks:  HealthCheck[];
  tips:    string[];
};

function checkPresent(name: string, envVar: string, placeholderRegex?: RegExp): HealthCheck {
  const v = process.env[envVar];
  if (!v) return { name, status: "fail", detail: `${envVar} not set` };
  if (placeholderRegex && placeholderRegex.test(v)) {
    return { name, status: "warn", detail: `${envVar} appears to be a placeholder` };
  }
  return { name, status: "ok" };
}

async function checkDb(): Promise<HealthCheck> {
  if (!isDbConnected()) {
    return { name: "Database connection", status: "fail", detail: "DATABASE_URL not set" };
  }
  try {
    const result = await db.execute(sql`SELECT 1 as ok`);
    const schema = z.array(z.object({ ok: z.number() }));
    const rows = schema.parse(result.rows);
    const okValue = rows[0]?.ok ?? null;
    if (okValue !== 1) {
      return { name: "Database connection", status: "warn", detail: "Unexpected query result" };
    }
    return { name: "Database connection", status: "ok" };
  } catch (err) {
    return {
      name:   "Database connection",
      status: "fail",
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkInboxProviderEnum(): Promise<HealthCheck> {
  if (!isDbConnected()) {
    return { name: "inbox_provider enum has 'mailmind'", status: "fail", detail: "no DB" };
  }
  try {
    const result = await db.execute(
      sql`SELECT enum_range(NULL::inbox_provider) AS values`
    );
    const schema = z.array(z.object({ values: z.string() }));
    const rows = schema.parse(result.rows);
    const raw = rows[0]?.values ?? "";
    if (raw.includes("mailmind")) {
      return { name: "inbox_provider enum has 'mailmind'", status: "ok", detail: raw };
    }
    return {
      name:   "inbox_provider enum has 'mailmind'",
      status: "fail",
      detail: `Missing — run: ALTER TYPE inbox_provider ADD VALUE 'mailmind';   (current: ${raw})`,
    };
  } catch (err) {
    return {
      name:   "inbox_provider enum has 'mailmind'",
      status: "fail",
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function checkStripeKeyAlignment(): HealthCheck {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  if (!secret || !pub) {
    return { name: "Stripe key environment alignment", status: "warn", detail: "missing keys" };
  }
  const secretLive = secret.startsWith("sk_live_");
  const secretTest = secret.startsWith("sk_test_") || secret.startsWith("rk_test_");
  const pubLive    = pub.startsWith("pk_live_");
  const pubTest    = pub.startsWith("pk_test_");

  if (secretLive && pubTest) {
    return {
      name:   "Stripe key environment alignment",
      status: "fail",
      detail: "Secret is LIVE but publishable is TEST — checkout will fail",
    };
  }
  if (secretTest && pubLive) {
    return {
      name:   "Stripe key environment alignment",
      status: "fail",
      detail: "Secret is TEST but publishable is LIVE — checkout will fail",
    };
  }
  if (/replace_me|placeholder/i.test(pub)) {
    return { name: "Stripe key environment alignment", status: "warn", detail: "publishable key is placeholder" };
  }
  return { name: "Stripe key environment alignment", status: "ok" };
}

/**
 * Run every check in parallel where possible. Single source of truth — both the
 * authenticated API endpoint and the in-app admin page consume this.
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheck[] = [
    checkPresent("Clerk publishable key",     "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    checkPresent("Clerk secret key",          "CLERK_SECRET_KEY"),
    checkPresent("Clerk webhook secret",      "CLERK_WEBHOOK_SECRET", /^(whsec_replace_me|placeholder)$/i),
    checkPresent("Stripe secret key",         "STRIPE_SECRET_KEY"),
    checkPresent("Stripe publishable key",    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", /replace_me|placeholder/i),
    checkPresent("Stripe webhook secret",     "STRIPE_WEBHOOK_SECRET", /^(whsec_replace_me|placeholder)$/i),
    checkStripeKeyAlignment(),
    checkPresent("Anthropic API key",         "ANTHROPIC_API_KEY"),
    checkPresent("Resend API key",            "RESEND_API_KEY"),
    checkPresent("App URL",                   "NEXT_PUBLIC_APP_URL"),
    await checkDb(),
    await checkInboxProviderEnum(),
  ];

  const summary = {
    ok:   checks.filter(c => c.status === "ok").length,
    warn: checks.filter(c => c.status === "warn").length,
    fail: checks.filter(c => c.status === "fail").length,
  };

  const overall: HealthStatus = summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "ok";

  return {
    overall,
    summary,
    checks,
    tips: [
      "If 'inbox_provider enum has mailmind' fails, run in Neon SQL Editor: ALTER TYPE inbox_provider ADD VALUE 'mailmind';",
      "If Stripe alignment fails, get matching test or live keys from https://dashboard.stripe.com/test/apikeys",
      "If Clerk webhook secret is placeholder, configure endpoint at Clerk Dashboard → Webhooks pointing to /api/webhooks/clerk",
    ],
  };
}
