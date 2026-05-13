/**
 * GET /api/app/inboxes/gmail/auth
 *
 * Redirects the authenticated user to Google's OAuth consent screen.
 * Sets a short-lived CSRF state cookie so the callback can verify the request.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { buildOAuthUrl } from "@/lib/app/gmail";
import { getCurrentAccount } from "@/lib/app/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked" }, { status: 403 });
  }

  if (!process.env.GMAIL_CLIENT_ID) {
    return NextResponse.json({ error: "Gmail OAuth not configured (GMAIL_CLIENT_ID missing)" }, { status: 503 });
  }

  const state = randomBytes(16).toString("hex");
  const url   = buildOAuthUrl(state);

  const response = NextResponse.redirect(url);
  // state cookie expires in 10 minutes
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600,
    path:     "/",
  });

  return response;
}
