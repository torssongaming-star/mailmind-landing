/**
 * GET /api/app/team/accept?token=<token>
 *
 * Accept a team invite. Flow:
 *   1. If not signed in → redirect to /login with this URL as redirect_url
 *   2. Validate token + email match
 *   3. Provision user into org
 *   4. Redirect to /app
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { acceptInvite } from "@/lib/app/team";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";

/**
 * Safe-redirect helper — only allows redirects to URLs on our own origin.
 * Prevents open-redirect attacks via crafted token-accept URLs.
 */
function safeRedirect(target: string): NextResponse {
  try {
    const url = new URL(target, APP_URL);
    const appOrigin = new URL(APP_URL).origin;
    if (url.origin !== appOrigin) {
      // External target — refuse and bounce to /app instead
      return NextResponse.redirect(`${APP_URL}/app?invite_error=invalid_redirect`);
    }
    return NextResponse.redirect(url.toString());
  } catch {
    return NextResponse.redirect(`${APP_URL}/app?invite_error=invalid_redirect`);
  }
}

export async function GET(req: NextRequest) {
  // Hard limit on token length so we don't generate ridiculous URLs
  const rawToken = new URL(req.url).searchParams.get("token");
  const token = rawToken && rawToken.length <= 128 ? rawToken : null;
  if (!token) {
    return safeRedirect(`${APP_URL}/app?invite_error=missing_token`);
  }

  const { userId } = await auth();

  // Not signed in — redirect to Clerk login then back here.
  // Important: the redirect_url MUST be on our own origin.
  if (!userId) {
    const returnUrl = encodeURIComponent(`${APP_URL}/api/app/team/accept?token=${token}`);
    return safeRedirect(`${APP_URL}/login?redirect_url=${returnUrl}`);
  }

  const clerkUser = await currentUser();
  const email     = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";

  if (!email) {
    return safeRedirect(`${APP_URL}/app?invite_error=no_email`);
  }

  const result = await acceptInvite(token, userId, email);

  if (!result.ok) {
    // Whitelist the error code to keep the URL clean and predictable
    const safeError = /^[a-z_]{1,40}$/.test(result.error) ? result.error : "unknown";
    return safeRedirect(`${APP_URL}/app?invite_error=${safeError}`);
  }

  await writeAuditLog({
    organizationId: result.orgId,
    action:         "team_invite_accepted",
    metadata:       { email },
  });

  return safeRedirect(`${APP_URL}/app?invite_accepted=1`);
}
