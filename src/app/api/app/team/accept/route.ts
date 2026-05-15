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

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/app?invite_error=missing_token`);
  }

  const { userId } = await auth();

  // Not signed in — redirect to Clerk login then back here
  if (!userId) {
    const returnUrl = encodeURIComponent(`${APP_URL}/api/app/team/accept?token=${token}`);
    return NextResponse.redirect(`${APP_URL}/login?redirect_url=${returnUrl}`);
  }

  const clerkUser = await currentUser();
  const email     = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";

  if (!email) {
    return NextResponse.redirect(`${APP_URL}/app?invite_error=no_email`);
  }

  const result = await acceptInvite(token, userId, email);

  if (!result.ok) {
    return NextResponse.redirect(`${APP_URL}/app?invite_error=${result.error}`);
  }

  await writeAuditLog({
    organizationId: result.orgId,
    action:         "team_invite_accepted",
    metadata:       { email },
  });

  return NextResponse.redirect(`${APP_URL}/app?invite_accepted=1`);
}
