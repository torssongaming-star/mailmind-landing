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
 * Check logic lives in `@/lib/admin/health` so the in-app admin page can show
 * the same data without needing the secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/admin/health";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  if (adminSecret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? req.headers.get("x-admin-secret") ?? "";
    if (provided !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const report = await runHealthChecks();
  return NextResponse.json(report, {
    status: report.overall === "fail" ? 503 : 200,
  });
}
