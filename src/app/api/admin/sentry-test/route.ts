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
import * as Sentry from "@sentry/nextjs";

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

  // Diagnostic: log whether the Sentry client is initialized + DSN visible.
  const client = Sentry.getClient();
  const dsnSet = Boolean(process.env.SENTRY_DSN);
  console.log("[sentry-test] diag", {
    dsnEnvSet:        dsnSet,
    dsnLengthChars:   process.env.SENTRY_DSN?.length ?? 0,
    clientInitialized: Boolean(client),
    clientDsn:        client?.getOptions().dsn ?? null,
  });

  // Explicit capture — flush before responding so we know if delivery itself
  // works, independent of onRequestError auto-instrumentation.
  const eventId = Sentry.captureException(
    new Error("SentryTestError: explicit capture probe"),
    { tags: { source: "sentry-test-route" } },
  );
  await Sentry.flush(5000);
  console.log("[sentry-test] explicit captureException eventId:", eventId);

  // Also throw, to exercise the onRequestError pathway separately.
  throw new Error("SentryTestError: intentional verification probe");
}
