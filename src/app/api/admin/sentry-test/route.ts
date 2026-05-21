/**
 * GET /api/admin/sentry-test
 *
 * Triggers a known error so you can verify Sentry is receiving events.
 * Protected by the same admin secret as /api/admin/health.
 *
 * Usage:
 *   curl "https://mailmind.se/api/admin/sentry-test?secret=YOUR_ADMIN_HEALTH_SECRET"
 *
 * Expected:
 *   - HTTP 500 with { error: "intentional_sentry_test" }
 *   - Within 30s, a "SentryTestError" event appears in Sentry Issues
 *
 * Delete this file once verification is done if you want.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireInProduction } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const adminSecret = requireInProduction("ADMIN_HEALTH_SECRET");
  if (adminSecret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? req.headers.get("x-admin-secret") ?? "";
    const maxLen = Math.max(provided.length, adminSecret.length);
    const providedBuf = Buffer.alloc(maxLen, 0);
    const secretBuf   = Buffer.alloc(maxLen, 0);
    Buffer.from(provided).copy(providedBuf);
    Buffer.from(adminSecret).copy(secretBuf);
    const ok = provided.length === adminSecret.length && crypto.timingSafeEqual(providedBuf, secretBuf);
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Throw so the Next.js error boundary forwards to Sentry. A plain
  // captureException would also work but throwing exercises the full
  // server-error pipeline.
  throw new Error("SentryTestError: intentional verification probe");
}
