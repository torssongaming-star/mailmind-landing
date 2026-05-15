/**
 * PATCH  /api/app/team/members/:id  — change role (owner only)
 * DELETE /api/app/team/members/:id  — remove member (owner/admin, not owner)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { changeMemberRole, removeMember } from "@/lib/app/team";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const PatchBody = z.object({
  role: z.enum(["admin", "member"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  // Only owner can change roles
  if (account.user.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id: memberId } = await params;
  await changeMemberRole(account.organization.id, memberId, parsed.data.role);

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "team_role_changed",
    metadata:       { memberId, newRole: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (account.user.role !== "owner" && account.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: memberId } = await params;

  // Prevent self-removal
  if (memberId === account.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  await removeMember(account.organization.id, memberId);

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "team_member_removed",
    metadata:       { memberId },
  });

  return NextResponse.json({ ok: true });
}
