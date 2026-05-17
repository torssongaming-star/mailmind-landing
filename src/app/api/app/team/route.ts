/**
 * GET  /api/app/team  — list members + pending invites (owner/admin only)
 * POST /api/app/team  — send an invite (owner/admin, seat-gated)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import {
  listMembers,
  listPendingInvites,
  createInvite,
  countMembers,
} from "@/lib/app/team";
import { notifyInvite } from "@/lib/app/notify";
import { writeAuditLog } from "@/lib/app/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (account.user.role !== "owner" && account.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [members, invites] = await Promise.all([
    listMembers(account.organization.id),
    listPendingInvites(account.organization.id),
  ]);

  return NextResponse.json({ members, invites });
}

const InviteBody = z.object({
  email: z.string().email(),
  role:  z.enum(["admin", "member"]),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked" }, { status: 403 });
  }
  if (account.user.role !== "owner" && account.user.role !== "admin") {
    return NextResponse.json({ error: "Only owners and admins can invite members" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = InviteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, role } = parsed.data;
  const orgId = account.organization.id;

  // Rate limit invites per org — 10/hour to prevent spam-invites
  if (!rateLimit(`invite:${orgId}`, RATE_LIMITS.invite)) {
    return NextResponse.json(
      { error: "Du har skickat för många inbjudningar nyligen. Försök igen om en stund." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Seat limit check — uses centralised entitlements (strategi-revision P2.1).
  // account.usersUsed is computed from real DB count now; canInviteUser
  // combines that with role + plan limit.
  if (!account.access.canInviteUser) {
    const maxUsers = account.entitlements?.maxUsers ?? 2;
    return NextResponse.json(
      { error: `Seat limit reached (${account.usersUsed}/${maxUsers}). Upgrade to add more members.`, reason: account.access.reason },
      { status: 403 },
    );
  }
  // Also count pending invites so we don't oversend
  const memberCount = await countMembers(orgId);
  const maxUsers = account.entitlements?.maxUsers ?? 2;
  if (memberCount >= maxUsers) {
    return NextResponse.json(
      { error: `Seat limit reached (${memberCount}/${maxUsers}). Upgrade to add more members.` },
      { status: 403 },
    );
  }

  // Admin cannot invite admins (only owner can grant admin role)
  if (account.user.role === "admin" && role === "admin") {
    return NextResponse.json({ error: "Only the owner can invite admins" }, { status: 403 });
  }

  const invite = await createInvite({
    organizationId:  orgId,
    email,
    role,
    invitedByUserId: account.user.id,
  });

  if (!invite) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Send invite email (non-fatal — invite is created regardless)
  let emailSent = false;
  try {
    await notifyInvite({
      toEmail:   email,
      invitedBy: account.user.email,
      orgName:   account.organization.name,
      role,
      token:     invite.token,
    });
    emailSent = true;
  } catch (err) {
    console.error("[team/invite] email send failed:", err);
  }

  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "team_invite_sent",
    metadata:       { email, role, inviteId: invite.id, emailSent },
  });

  return NextResponse.json({
    ok: true,
    invite:      { id: invite.id, email, role },
    emailSent,
    // Accept link so owner can copy-paste if email failed
    acceptLink:  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se"}/api/app/team/accept?token=${invite.token}`,
  });
}
