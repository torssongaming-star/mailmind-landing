/**
 * Role-based access helpers — server-side only.
 *
 * Org configuration (AI settings, knowledge base, webhooks, case types,
 * blocklist, templates, inbox lifecycle) should only be mutable by owners
 * and admins. A regular "member" can read but not modify. Without this,
 * a compromised member account could:
 *
 *   - reroute support replies via attacker-controlled webhook URLs,
 *   - poison the knowledge base the AI grounds answers in,
 *   - disconnect production inboxes,
 *   - blocklist legitimate senders.
 *
 * Use requireOrgAdmin at the top of every mutation route in /api/app/**
 * that touches org-wide configuration.
 */

import type { AccountSnapshot } from "./entitlements";

export type OrgRole = "owner" | "admin" | "member";

export function hasOrgAdminRole(account: AccountSnapshot): boolean {
  const role = account.user?.role;
  return role === "owner" || role === "admin";
}

/**
 * Returns null when the caller has admin/owner role, or a NextResponse-shaped
 * { status, body } object when they don't. Callers pass it through as
 * `return NextResponse.json(body, { status })`.
 *
 * Done as a value instead of a thrown error so the caller controls the
 * response shape and keeps the file linear.
 */
export function requireOrgAdmin(
  account: AccountSnapshot,
): { status: 403; body: { error: string; reason: "role_required" } } | null {
  if (hasOrgAdminRole(account)) return null;
  return {
    status: 403,
    body: { error: "Owner or admin role required", reason: "role_required" },
  };
}
