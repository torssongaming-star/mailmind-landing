import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Checks if a user is a Mailmind internal admin.
 * 
 * Criteria:
 * 1. Email is in ADMIN_EMAILS environment variable.
 * 2. Clerk privateMetadata has mailmindRole set to "admin" or "superadmin".
 */
export async function isMailmindAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  // 1. Check ADMIN_EMAILS for bootstrap/env-based access
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()) ?? [];
  const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase();
  
  if (userEmail && adminEmails.includes(userEmail)) {
    return true;
  }

  // 2. Check Clerk privateMetadata for permanent roles
  const role = user.privateMetadata?.mailmindRole;
  if (role === "admin" || role === "superadmin") {
    return true;
  }

  return false;
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
