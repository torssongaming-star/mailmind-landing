import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Checks if a user is a Mailmind internal admin.
 *
 * Access is granted only when Clerk privateMetadata.mailmindRole is "admin"
 * or "superadmin". Set this via the Clerk Dashboard or the Clerk API.
 */
export async function isMailmindAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  const role = user.privateMetadata?.mailmindRole;
  return role === "admin" || role === "superadmin";
}

/**
 * Server-side guard for admin pages.
 * Redirects non-admins to the app dashboard or login.
 */
export async function requireMailmindAdmin() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const isAdmin = await isMailmindAdmin();
  if (!isAdmin) {
    // Tydlig "Access denied" redirect or 404
    // Following user request: redirect to /app
    redirect("/app");
  }
}

/**
 * API-side guard for admin endpoints.
 * Returns { status: 403, body: { error: string } } if not authorized, null if OK.
 * Usage: const guard = await requireAdminApi(); if (guard) return NextResponse.json(guard.body, { status: guard.status });
 */
export async function requireAdminApi(): Promise<{ status: 403; body: { error: string } } | null> {
  const isAdmin = await isMailmindAdmin();
  if (!isAdmin) {
    return { status: 403, body: { error: "Unauthorized: Internal Admin access required" } };
  }
  return null;
}

/**
 * Gets the current admin's identity for audit logging.
 */
export async function getAdminIdentity() {
  const user = await currentUser();
  if (!user) return null;

  return {
    clerkUserId: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    role: user.privateMetadata?.mailmindRole as string | undefined,
  };
}
