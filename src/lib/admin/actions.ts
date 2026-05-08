"use server";

import { db } from "@/lib/db";
import { adminNotes, adminCustomerProfiles, adminAuditLogs } from "@/lib/db/schema";
import { getAdminIdentity, requireAdminApi } from "@/lib/admin/auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

/**
 * Creates an internal admin note.
 */
export async function createAdminNoteAction(data: {
  subjectType: "user" | "organization" | "enterprise" | "general";
  content: string;
  targetClerkUserId?: string;
  targetOrganizationId?: string;
}) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    await db.insert(adminNotes).values({
      subjectType: data.subjectType,
      content: data.content,
      authorClerkUserId: admin.clerkUserId,
      targetClerkUserId: data.targetClerkUserId,
      targetOrganizationId: data.targetOrganizationId,
    });

    // Log the action
    await db.insert(adminAuditLogs).values({
      actorClerkUserId: admin.clerkUserId,
      actorEmail: admin.email!,
      action: "note_created",
      targetType: data.subjectType,
      targetClerkUserId: data.targetClerkUserId,
      targetOrganizationId: data.targetOrganizationId,
      metadata: { content_preview: data.content.slice(0, 50) + "..." },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Failed to create admin note:", error);
    return { success: false, error: "Failed to save note" };
  }
}

/**
 * Updates the internal status of a customer (Pilot, Enterprise, etc.)
 */
export async function updateCustomerStatusAction(data: {
  organizationId: string;
  status: "internal_test" | "pilot" | "active_customer" | "enterprise_lead" | "enterprise_customer" | "churned";
}) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    // Upsert the profile
    const existing = await db.query.adminCustomerProfiles.findFirst({
      where: eq(adminCustomerProfiles.organizationId, data.organizationId),
    });

    if (existing) {
      await db.update(adminCustomerProfiles)
        .set({ status: data.status, updatedAt: new Date() })
        .where(eq(adminCustomerProfiles.organizationId, data.organizationId));
    } else {
      await db.insert(adminCustomerProfiles).values({
        organizationId: data.organizationId,
        status: data.status,
      });
    }

    // Log the action
    await db.insert(adminAuditLogs).values({
      actorClerkUserId: admin.clerkUserId,
      actorEmail: admin.email!,
      action: "customer_status_changed",
      targetOrganizationId: data.organizationId,
      metadata: { new_status: data.status },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Failed to update customer status:", error);
    return { success: false, error: "Failed to update status" };
  }
}

/**
 * Triggers a password reset instruction flow in Clerk.
 * NOTE: For MVP, we'll log it and let the client call the Clerk SDK or our API.
 */
export async function logPasswordResetAction(targetClerkUserId: string, email: string) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  await db.insert(adminAuditLogs).values({
    actorClerkUserId: admin.clerkUserId,
    actorEmail: admin.email!,
    action: "password_reset_requested",
    targetClerkUserId: targetClerkUserId,
    metadata: { target_email: email },
  });

  return { success: true };
}
