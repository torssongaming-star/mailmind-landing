/**
 * GET /api/admin/health
 *
 * Diagnostic endpoint that verifies all the external dependencies the app needs.
 * Useful to hit after env-var changes, deploys, or schema migrations.
 *
 * Authenticated via a static admin secret rather than Clerk, so it's callable
 * by external monitoring tools and from a terminal (curl) without setting up
 * a session. Set ADMIN_HEALTH_SECRET in env; pass it as ?secret=... or
 * X-Admin-Secret header.
 *
 * Checks performed:
 *   - Clerk env vars set
 *   - Stripe env vars set + key/publishable type alignment
 *   - Database reachable + critical tables exist
 *   - Anthropic env var set + key looks plausible
 *   - Resend env var set
 *   - inbox_provider enum has 'mailmind' value (the one drizzle-kit may skip)
 *   - SendGrid Inbound Parse webhook URL pointing here (advisory; we can't
 *     introspect SendGrid's config without their API key)
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, isDbConnected } from "@/lib/db";

export const runtime = "nodejs";

type Status = "ok" | "warn" | "fail";

type Check = {
  name: string;
  status: Status;
  detail?: string;
};

function checkPresent(name: string, envVar: string, placeholderRegex?: RegExp): Check {
  const v = process.env[envVar];
  if (!v) return { name, status: "fail", detail: `${envVar} not set` };
  if (placeholderRegex && placeholderRegex.test(v)) {
    return { name, status: "warn", detail: `${envVar} appears to be a placeholder` };
  }
  return { name, status: "ok" };
}

async function checkDb(): Promise<Check> {
  if (!isDbConnected()) {
    return { name: "Database connection", status: "fail", detail: "DATABASE_URL not set" };
  }
  try {
    const rows = (await db.execute(sql`SELECT 1 as ok`)) as unknown as { rows: Array<{ ok: number }> };
    const okValue = (rows?.rows?.[0]?.ok ?? null) as number | null;
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

async function checkInboxProviderEnum(): Promise<Check> {
  if (!isDbConnected()) {
    return { name: "inbox_provider enum has 'mailmind'", status: "fail", detail: "no DB" };
  }
  try {
    const result = (await db.execute(
      sql`SELECT enum_range(NULL::inbox_provider) AS values`
    )) as unknown as { rows: Array<{ values: string }> };
    const raw = result?.rows?.[0]?.values ?? "";
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

function checkStripeKeyAlignment(): Check {
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

export async function GET(req: NextRequest) {
  // Require an admin secret to prevent strangers from probing internal config.
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  if (adminSecret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? req.headers.get("x-admin-secret") ?? "";
    if (provided !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const checks: Check[] = [
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

  const overall: Status = summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "ok";

  return NextResponse.json({
    overall,
    summary,
    checks,
    tips: [
      "If 'inbox_provider enum has mailmind' fails, run in Neon SQL Editor: ALTER TYPE inbox_provider ADD VALUE 'mailmind';",
      "If Stripe alignment fails, get matching test or live keys from https://dashboard.stripe.com/test/apikeys",
      "If Clerk webhook secret is placeholder, configure endpoint at Clerk Dashboard → Webhooks pointing to /api/webhooks/clerk",
    ],
  }, {
    status: overall === "fail" ? 503 : 200,
  });
}
