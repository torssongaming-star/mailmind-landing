/**
 * POST /api/app/onboarding
 *
 * Provisions the authenticated Clerk user in the Mailmind DB by creating an
 * organization (single-tenant for now — one org per user) and a `users` row.
 * Idempotent: if the user already exists, returns the existing record.
 *
 * This is the explicit "create my account" step shown after first login on
 * /app/onboarding. The brief specifies single-tenant for now (clerkOrgId = null).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncUserAndOrganization } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const Body = z.object({
  orgName: z.string().trim().min(1).max(120),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "Clerk user missing email" }, { status: 400 });
  }

  const result = await syncUserAndOrganization({
    clerkUserId: userId,
    email,
    clerkOrgId:  null, // single-tenant for now (briefen §3)
    orgName:     parsed.data.orgName,
  });

  if (!result) {
    // DB not connected — caller will see mock data instead. Still return 200
    // so the UI flow continues to /app where mock fallback kicks in.
    return NextResponse.json({ ok: true, mock: true });
  }

  await writeAuditLog({
    organizationId: result.organizationId,
    userId:         result.user.id,
    action:         "onboarding_completed",
    metadata:       { orgName: parsed.data.orgName, email },
  });

  return NextResponse.json({
    ok: true,
    user: { id: result.user.id, email: result.user.email },
    organizationId: result.organizationId,
  });
}
