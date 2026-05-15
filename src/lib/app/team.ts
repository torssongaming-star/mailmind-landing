/**
 * Team management helpers — invites + member CRUD.
 * All operations are organizationId-scoped.
 */

import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, isDbConnected } from "@/lib/db";
import { users, orgInvites, organizations } from "@/lib/db/schema";

const INVITE_TTL_HOURS = 72; // invites expire after 3 days

// ── Members ───────────────────────────────────────────────────────────────────

export async function listMembers(organizationId: string) {
  if (!isDbConnected()) return [];
  return db
    .select({
      id:        users.id,
      email:     users.email,
      role:      users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .orderBy(users.createdAt);
}

export async function countMembers(organizationId: string): Promise<number> {
  if (!isDbConnected()) return 0;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organizationId, organizationId));
  return rows.length;
}

/** Change a member's role. Owner cannot be demoted via this function. */
export async function changeMemberRole(
  organizationId: string,
  userId: string,
  newRole: "admin" | "member",
) {
  if (!isDbConnected()) return;
  // Safety: never demote the owner via this path
  await db
    .update(users)
    .set({ role: newRole })
    .where(
      and(
        eq(users.id, userId),
        eq(users.organizationId, organizationId),
        // Prevent accidental owner demotion
        eq(users.role, newRole === "admin" ? "member" : "admin"),
      )
    );
}

/** Remove a member from the org. Cannot remove the owner. */
export async function removeMember(organizationId: string, userId: string) {
  if (!isDbConnected()) return;
  await db
    .delete(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.organizationId, organizationId),
        // Never delete the owner
        eq(users.role, "member"),
      )
    );
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function listPendingInvites(organizationId: string) {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.organizationId, organizationId),
        isNull(orgInvites.acceptedAt),
        gt(orgInvites.expiresAt, new Date()),
      )
    )
    .orderBy(desc(orgInvites.createdAt));
}

export async function createInvite(input: {
  organizationId:  string;
  email:           string;
  role:            "admin" | "member";
  invitedByUserId: string;
}) {
  if (!isDbConnected()) return null;

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  const rows = await db
    .insert(orgInvites)
    .values({
      organizationId:  input.organizationId,
      email:           input.email.toLowerCase(),
      role:            input.role,
      token,
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    })
    .returning();

  return rows[0] ?? null;
}

export async function cancelInvite(organizationId: string, inviteId: string) {
  if (!isDbConnected()) return;
  await db
    .delete(orgInvites)
    .where(
      and(
        eq(orgInvites.id, inviteId),
        eq(orgInvites.organizationId, organizationId),
      )
    );
}

export async function getInviteByToken(token: string) {
  if (!isDbConnected()) return null;
  const rows = await db
    .select()
    .from(orgInvites)
    .where(eq(orgInvites.token, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Accept an invite: provision the user into the org + mark invite accepted.
 * If a user row already exists (e.g. the invitee already has an account
 * in another org), we update their org + role.
 */
export async function acceptInvite(
  token: string,
  clerkUserId: string,
  email: string,
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  if (!isDbConnected()) return { ok: false, error: "db_unavailable" };

  const invite = await getInviteByToken(token);
  if (!invite)                        return { ok: false, error: "invite_not_found" };
  if (invite.acceptedAt)              return { ok: false, error: "invite_already_used" };
  if (invite.expiresAt < new Date())  return { ok: false, error: "invite_expired" };

  // Email must match (case-insensitive)
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: "invite_email_mismatch" };
  }

  const orgRows = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, invite.organizationId))
    .limit(1);
  if (!orgRows[0]) return { ok: false, error: "org_not_found" };

  // Upsert user into the invited org
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1)
    .then(r => r[0] ?? null);

  if (existing) {
    // Move to new org + update role
    await db
      .update(users)
      .set({ organizationId: invite.organizationId, role: invite.role })
      .where(eq(users.clerkUserId, clerkUserId));
  } else {
    // Create new user row
    await db.insert(users).values({
      clerkUserId,
      email:          email.toLowerCase(),
      organizationId: invite.organizationId,
      role:           invite.role,
    });
  }

  // Mark invite accepted
  await db
    .update(orgInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(orgInvites.id, invite.id));

  return { ok: true, orgId: invite.organizationId };
}
