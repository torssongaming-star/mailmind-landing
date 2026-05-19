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
 * Throws an error or returns false if not authorized.
 */
export async function requireAdminApi() {
  const isAdmin = await isMailmindAdmin();
  if (!isAdmin) {
    throw new Error("Unauthorized: Internal Admin access required");
  }
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
