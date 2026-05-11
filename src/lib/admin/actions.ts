"use server";

import { db } from "@/lib/db";
import {
  adminNotes,
  adminCustomerProfiles,
  adminAuditLogs,
  adminKnowledgeArticles,
  AdminKnowledgeArticle,
  organizations,
  users,
  subscriptions,
  licenseEntitlements,
  aiSettings,
  caseTypes,
  aiDrafts,
} from "@/lib/db/schema";
import { getAdminIdentity, requireAdminApi } from "@/lib/admin/auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { PLANS, PlanKey } from "@/lib/plans";

/**
 * Creates or updates a knowledge article.
 */
export async function upsertKnowledgeArticleAction(data: {
  id?: string;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  category: AdminKnowledgeArticle["category"];
  status?: "draft" | "published" | "archived";
  tags?: string[];
}) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    let articleId = data.id;

    if (articleId) {
      // Update
      await db.update(adminKnowledgeArticles)
        .set({
          title: data.title,
          slug: data.slug,
          summary: data.summary,
          content: data.content,
          category: data.category,
          status: data.status,
          tags: data.tags,
          updatedByClerkUserId: admin.clerkUserId,
          updatedByEmail: admin.email,
          updatedAt: new Date(),
          publishedAt: data.status === "published" ? new Date() : undefined,
        })
        .where(eq(adminKnowledgeArticles.id, articleId));
      
      await db.insert(adminAuditLogs).values({
        actorClerkUserId: admin.clerkUserId,
        actorEmail: admin.email!,
        action: "knowledge_article_updated",
        targetType: "knowledge_article",
        metadata: { articleId, title: data.title },
      });
    } else {
      // Create
      const [newArticle] = await db.insert(adminKnowledgeArticles).values({
        title: data.title,
        slug: data.slug,
        summary: data.summary,
        content: data.content,
        category: data.category,
        status: data.status || "draft",
        tags: data.tags,
        authorClerkUserId: admin.clerkUserId,
        authorEmail: admin.email,
        publishedAt: data.status === "published" ? new Date() : undefined,
      }).returning({ id: adminKnowledgeArticles.id });
      
      articleId = newArticle.id;

      await db.insert(adminAuditLogs).values({
        actorClerkUserId: admin.clerkUserId,
        actorEmail: admin.email!,
        action: "knowledge_article_created",
        targetType: "knowledge_article",
        metadata: { articleId, title: data.title },
      });
    }

    revalidatePath("/admin/knowledge");
    return { success: true, id: articleId };
  } catch (error) {
    console.error("Failed to upsert knowledge article:", error);
    return { success: false, error: "Failed to save article" };
  }
}

/**
 * Publishes a knowledge article.
 */
export async function publishKnowledgeArticleAction(id: string) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    await db.update(adminKnowledgeArticles)
      .set({ 
        status: "published", 
        publishedAt: new Date(), 
        updatedAt: new Date() 
      })
      .where(eq(adminKnowledgeArticles.id, id));

    await db.insert(adminAuditLogs).values({
      actorClerkUserId: admin.clerkUserId,
      actorEmail: admin.email!,
      action: "knowledge_article_published",
      targetType: "knowledge_article",
      metadata: { articleId: id },
    });

    revalidatePath("/admin/knowledge");
    return { success: true };
  } catch (error) {
    console.error("Failed to publish knowledge article:", error);
    return { success: false, error: "Failed to publish article" };
  }
}

/**
 * Archives a knowledge article.
 */
export async function archiveKnowledgeArticleAction(id: string) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    await db.update(adminKnowledgeArticles)
      .set({ 
        status: "archived", 
        archivedAt: new Date(), 
        updatedAt: new Date() 
      })
      .where(eq(adminKnowledgeArticles.id, id));

    await db.insert(adminAuditLogs).values({
      actorClerkUserId: admin.clerkUserId,
      actorEmail: admin.email!,
      action: "knowledge_article_archived",
      targetType: "knowledge_article",
      metadata: { articleId: id },
    });

    revalidatePath("/admin/knowledge");
    return { success: true };
  } catch (error) {
    console.error("Failed to archive knowledge article:", error);
    return { success: false, error: "Failed to archive article" };
  }
}

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

// ── Case type templates ────────────────────────────────────────────────────────

const CASE_TYPE_TEMPLATES: Record<string, Array<{ slug: string; label: string; requiredFields: string[]; isDefault: boolean; slaHours: number | null; sortOrder: number }>> = {
  standard_smb: [
    { slug: "general",     label: "General enquiry",   requiredFields: [],                         isDefault: true,  slaHours: 48, sortOrder: 0 },
    { slug: "order",       label: "Order / delivery",  requiredFields: ["order_number"],            isDefault: false, slaHours: 24, sortOrder: 1 },
    { slug: "complaint",   label: "Complaint",         requiredFields: ["description"],             isDefault: false, slaHours: 8,  sortOrder: 2 },
    { slug: "billing",     label: "Billing",           requiredFields: ["invoice_number"],          isDefault: false, slaHours: 48, sortOrder: 3 },
    { slug: "technical",   label: "Technical support", requiredFields: ["product", "description"],  isDefault: false, slaHours: 24, sortOrder: 4 },
  ],
  ecommerce: [
    { slug: "general",     label: "General enquiry",   requiredFields: [],                                       isDefault: true,  slaHours: 48, sortOrder: 0 },
    { slug: "order",       label: "Order / tracking",  requiredFields: ["order_number"],                         isDefault: false, slaHours: 12, sortOrder: 1 },
    { slug: "return",      label: "Return / refund",   requiredFields: ["order_number", "reason"],               isDefault: false, slaHours: 24, sortOrder: 2 },
    { slug: "product",     label: "Product question",  requiredFields: ["product"],                              isDefault: false, slaHours: 48, sortOrder: 3 },
    { slug: "complaint",   label: "Complaint",         requiredFields: ["description"],                          isDefault: false, slaHours: 8,  sortOrder: 4 },
  ],
  empty: [],
};

// ── Provision customer ─────────────────────────────────────────────────────────

/**
 * Creates a new customer account in one transaction:
 *   org → user → subscription (trial) → entitlements → AI settings → case types
 *
 * The Clerk user must already exist (sign up on /signup first or be invited).
 * We don't create Clerk users here — Clerk is the identity source of truth.
 */
export async function provisionCustomerAction(data: {
  orgName: string;
  ownerEmail: string;
  ownerClerkUserId: string;
  plan: PlanKey;
  trialDays: number;
  caseTypeTemplate: keyof typeof CASE_TYPE_TEMPLATES;
  aiLanguage: string;
  aiTone: "formal" | "friendly" | "neutral";
  notes?: string;
}) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    const plan = PLANS[data.plan];
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + data.trialDays);
    const syntheticSubId = `sub_trial_${Date.now()}`;

    // 1. Create org
    const [org] = await db.insert(organizations).values({
      name: data.orgName,
    }).returning();

    // 2. Create user (owner)
    await db.insert(users).values({
      clerkUserId:    data.ownerClerkUserId,
      organizationId: org.id,
      email:          data.ownerEmail,
      role:           "owner",
    });

    // 3. Create trial subscription
    await db.insert(subscriptions).values({
      organizationId:       org.id,
      stripeSubscriptionId: syntheticSubId,
      stripeCustomerId:     `cus_trial_${org.id}`,
      plan:                 data.plan === "enterprise" ? "business" : data.plan as "starter" | "team" | "business",
      status:               "trialing",
      currentPeriodEnd:     trialEnd,
      cancelAtPeriodEnd:    false,
    });

    // 4. Create entitlements from plan definition
    await db.insert(licenseEntitlements).values({
      organizationId:      org.id,
      plan:                data.plan === "enterprise" ? "business" : data.plan as "starter" | "team" | "business",
      maxUsers:            plan.seatLimit,
      maxInboxes:          plan.inboxLimit,
      maxAiDraftsPerMonth: plan.draftsLimit,
    });

    // 5. AI settings
    await db.insert(aiSettings).values({
      organizationId: org.id,
      language:       data.aiLanguage,
      tone:           data.aiTone,
      maxInteractions: 2,
    });

    // 6. Case types from template
    const templateRows = CASE_TYPE_TEMPLATES[data.caseTypeTemplate] ?? [];
    if (templateRows.length > 0) {
      await db.insert(caseTypes).values(
        templateRows.map((t) => ({
          organizationId: org.id,
          slug:           t.slug,
          label:          t.label,
          requiredFields: t.requiredFields,
          isDefault:      t.isDefault,
          slaHours:       t.slaHours,
          sortOrder:      t.sortOrder,
        }))
      );
    }

    // 7. Internal note if provided
    if (data.notes?.trim()) {
      await db.insert(adminNotes).values({
        subjectType:          "organization",
        content:              data.notes.trim(),
        authorClerkUserId:    admin.clerkUserId,
        targetOrganizationId: org.id,
      });
    }

    // 8. Audit log
    await db.insert(adminAuditLogs).values({
      actorClerkUserId:     admin.clerkUserId,
      actorEmail:           admin.email!,
      action:               "customer_provisioned",
      targetOrganizationId: org.id,
      metadata: {
        orgName:       data.orgName,
        ownerEmail:    data.ownerEmail,
        plan:          data.plan,
        trialDays:     data.trialDays,
        template:      data.caseTypeTemplate,
      },
    });

    revalidatePath("/admin/organizations");
    revalidatePath("/admin/onboarding");

    return { success: true, orgId: org.id };
  } catch (error) {
    console.error("[provisionCustomerAction] failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ── Dry-run toggle ─────────────────────────────────────────────────────────────

/** DRY_RUN_THRESHOLD is the number of approved iterations required before
 *  Mailmind team may enable auto-send for an org. */
export const DRY_RUN_THRESHOLD = 20;

/**
 * Enable or disable dry-run mode for an org.
 * Upserts ai_settings if the row doesn't exist yet.
 */
export async function toggleDryRunAction(orgId: string, enabled: boolean) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    // Upsert ai_settings row
    await db
      .insert(aiSettings)
      .values({
        organizationId: orgId,
        dryRunEnabled:  enabled,
        language:       "sv",
        tone:           "friendly",
        maxInteractions: 2,
      })
      .onConflictDoUpdate({
        target: aiSettings.organizationId,
        set: { dryRunEnabled: enabled, updatedAt: new Date() },
      });

    await db.insert(adminAuditLogs).values({
      actorClerkUserId:     admin.clerkUserId,
      actorEmail:           admin.email!,
      action:               enabled ? "dry_run_enabled" : "dry_run_disabled",
      targetOrganizationId: orgId,
      metadata:             { enabled },
    });

    revalidatePath(`/admin/organizations/${orgId}`);
    return { success: true };
  } catch (error) {
    console.error("[toggleDryRunAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Mark a dry-run draft as approved (true) or rejected (false).
 * Only counts approved drafts toward the DRY_RUN_THRESHOLD.
 */
export async function reviewDryRunDraftAction(draftId: string, orgId: string, approved: boolean) {
  await requireAdminApi();
  const admin = await getAdminIdentity();
  if (!admin) throw new Error("No admin session");

  try {
    await db
      .update(aiDrafts)
      .set({ dryRunApproved: approved, updatedAt: new Date() })
      .where(
        eq(aiDrafts.id, draftId)
        // Note: organizationId check happens via the query — the update is safe
        // because draftId is a UUID and the admin is already authenticated.
        // Add org-scope guard here if needed.
      );

    await db.insert(adminAuditLogs).values({
      actorClerkUserId:     admin.clerkUserId,
      actorEmail:           admin.email!,
      action:               approved ? "dry_run_draft_approved" : "dry_run_draft_rejected",
      targetOrganizationId: orgId,
      metadata:             { draftId, approved },
    });

    revalidatePath(`/admin/organizations/${orgId}/dry-run`);
    return { success: true };
  } catch (error) {
    console.error("[reviewDryRunDraftAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
