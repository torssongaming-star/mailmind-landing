import { db, isDbConnected } from "@/lib/db";
import {
  users,
  organizations,
  subscriptions,
  adminCustomerProfiles,
  adminNotes,
  adminAuditLogs,
  adminKnowledgeArticles,
  AdminKnowledgeArticle,
  emailThreads,
  aiDrafts,
  aiSettings,
  usageCounters,
  auditLogs,
  inboxes,
} from "@/lib/db/schema";
import { desc, eq, count, and, or, ilike, max, gte, sql } from "drizzle-orm";

/**
 * Gets overview statistics for the admin dashboard.
 */
export async function getAdminStats() {
  if (!isDbConnected()) return null;

  try {
    const [userCount] = await db.select({ value: count() }).from(users);
    const [orgCount] = await db.select({ value: count() }).from(organizations);
    const [activeSubs] = await db.select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));
    const [pilotCount] = await db.select({ value: count() })
      .from(adminCustomerProfiles)
      .where(eq(adminCustomerProfiles.status, "pilot"));

    return {
      totalUsers: userCount.value,
      totalOrgs: orgCount.value,
      activeSubscriptions: activeSubs.value,
      pilotCustomers: pilotCount.value,
    };
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return null;
  }
}

/**
 * Lists knowledge articles.
 */
export async function listKnowledgeArticles(options?: {
  status?: "draft" | "published" | "archived";
  category?: string;
}) {
  if (!isDbConnected()) return [];

  try {
    let query = db.select().from(adminKnowledgeArticles);
    
    const filters = [];
    if (options?.status) filters.push(eq(adminKnowledgeArticles.status, options.status));
    if (options?.category) filters.push(eq(adminKnowledgeArticles.category, options.category as AdminKnowledgeArticle["category"]));

    if (filters.length > 0) {
      // @ts-expect-error -- Drizzle and/or array spread typing mismatch
      query = query.where(and(...filters));
    }

    return await query.orderBy(desc(adminKnowledgeArticles.updatedAt));
  } catch (error) {
    console.error("Failed to list knowledge articles:", error);
    return [];
  }
}

/**
 * Gets a single knowledge article by ID or slug.
 */
export async function getKnowledgeArticle(idOrSlug: string) {
  if (!isDbConnected()) return null;

  try {
    const [article] = await db.select()
      .from(adminKnowledgeArticles)
      .where(
        or(
          eq(adminKnowledgeArticles.id, idOrSlug),
          eq(adminKnowledgeArticles.slug, idOrSlug)
        )
      )
      .limit(1);
    
    return article || null;
  } catch (error) {
    console.error("Failed to get knowledge article:", error);
    return null;
  }
}

/**
 * Searches knowledge articles.
 */
export async function searchKnowledgeArticles(query: string) {
  if (!isDbConnected()) return [];

  try {
    return await db.select()
      .from(adminKnowledgeArticles)
      .where(
        or(
          ilike(adminKnowledgeArticles.title, `%${query}%`),
          ilike(adminKnowledgeArticles.content, `%${query}%`),
          ilike(adminKnowledgeArticles.summary, `%${query}%`)
        )
      )
      .orderBy(desc(adminKnowledgeArticles.updatedAt));
  } catch (error) {
    console.error("Failed to search knowledge articles:", error);
    return [];
  }
}

/**
 * Lists users for the admin dashboard.
 */
export async function listAdminUsers() {
  if (!isDbConnected()) return [];

  try {
    return await db.query.users.findMany({
      with: {
        organization: true,
      },
      orderBy: [desc(users.createdAt)],
      limit: 100,
    });
  } catch (error) {
    console.error("Failed to list admin users:", error);
    return [];
  }
}

/**
 * Gets detailed info for a single user.
 */
export async function getAdminUser(clerkUserId: string) {
  if (!isDbConnected()) return null;

  try {
    return await db.query.users.findFirst({
      where: eq(users.clerkUserId, clerkUserId),
      with: {
        organization: {
          with: {
            subscriptions: true,
          }
        },
      },
    });
  } catch (error) {
    console.error("Failed to get admin user:", error);
    return null;
  }
}

/**
 * Lists organizations for the admin dashboard.
 */
export async function listAdminOrganizations() {
  if (!isDbConnected()) return [];

  try {
    return await db.query.organizations.findMany({
      with: {
        subscriptions: true,
        usageCounters: true,
      },
      orderBy: [desc(organizations.createdAt)],
      limit: 100,
    });
  } catch (error) {
    console.error("Failed to list admin organizations:", error);
    return [];
  }
}

/**
 * Gets health metrics for a list of organizations.
 */
export async function getOrganizationsHealth(organizationIds: string[]) {
  if (!isDbConnected() || organizationIds.length === 0) return {};

  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const threadStats = await db
      .select({
        organizationId: emailThreads.organizationId,
        count: count(),
        lastActivity: sql<Date | null>`max(${emailThreads.lastMessageAt})`,
      })
      .from(emailThreads)
      .where(sql`${emailThreads.organizationId} = ANY(ARRAY[${sql.join(organizationIds.map(id => sql`${id}`), sql`, `)}]::uuid[])`)
      .groupBy(emailThreads.organizationId);

    const usageStats = await db
      .select({
        organizationId: usageCounters.organizationId,
        aiDraftsUsed: usageCounters.aiDraftsUsed,
      })
      .from(usageCounters)
      .where(
        and(
          sql`${usageCounters.organizationId} = ANY(ARRAY[${sql.join(organizationIds.map(id => sql`${id}`), sql`, `)}]::uuid[])`,
          eq(usageCounters.month, month)
        )
      );

    const healthMap: Record<string, { threads: number; aiUsage: number; lastActivity: Date | null }> = {};
    
    organizationIds.forEach(id => {
      healthMap[id] = { threads: 0, aiUsage: 0, lastActivity: null };
    });

    threadStats.forEach(stat => {
      if (stat.organizationId) {
        healthMap[stat.organizationId].threads = stat.count;
        healthMap[stat.organizationId].lastActivity = stat.lastActivity;
      }
    });

    usageStats.forEach(stat => {
      healthMap[stat.organizationId].aiUsage = stat.aiDraftsUsed;
    });

    return healthMap;
  } catch (error) {
    console.error("Failed to fetch organizations health:", error);
    return {};
  }
}

/**
 * Gets detailed info for an organization.
 */
export async function getAdminOrganization(id: string) {
  if (!isDbConnected()) return null;

  try {
    return await db.query.organizations.findFirst({
      where: eq(organizations.id, id),
      with: {
        users:              true,
        subscriptions:      true,
        licenseEntitlement: true,
        usageCounters:      true,
        // aiSettings is NOT in organizationsRelations — query separately if needed
      },
    });
  } catch (error) {
    console.error("Failed to get admin organization:", error);
    return null;
  }
}

/**
 * Returns org health metrics: thread count, last activity, and real AI draft
 * count for the current calendar month (queried from aiDrafts directly because
 * usageCounters is not yet incremented at runtime).
 */
export async function getOrgHealth(orgId: string) {
  if (!isDbConnected()) return null;

  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [[threadRow], [draftMonthRow], [draftActivityRow], [auditRow]] = await Promise.all([
      db
        .select({
          threadCount:        count(emailThreads.id),
          lastThreadActivity: max(emailThreads.lastMessageAt),
        })
        .from(emailThreads)
        .where(eq(emailThreads.organizationId, orgId)),
      // Count drafts for current month (usageCounters is not written to yet)
      db
        .select({ value: count(aiDrafts.id) })
        .from(aiDrafts)
        .where(and(
          eq(aiDrafts.organizationId, orgId),
          gte(aiDrafts.generatedAt, monthStart),
        )),
      db
        .select({ lastDraftActivity: max(aiDrafts.generatedAt) })
        .from(aiDrafts)
        .where(eq(aiDrafts.organizationId, orgId)),
      db
        .select({ lastAuditActivity: max(auditLogs.createdAt) })
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId)),
    ]);

    // Resolve most recent activity from all sources
    const activities = [
      threadRow?.lastThreadActivity,
      draftActivityRow?.lastDraftActivity,
      auditRow?.lastAuditActivity,
    ].filter(Boolean) as Date[];

    const lastActivity = activities.length > 0
      ? new Date(Math.max(...activities.map(d => d.getTime())))
      : null;

    return {
      threadCount:       threadRow?.threadCount ?? 0,
      lastActivity,
      aiDraftsThisMonth: draftMonthRow?.value   ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch org health:", error);
    return null;
  }
}

/**
 * Returns dry-run stats for an org:
 *   total     — all dry-run drafts ever generated
 *   approved  — how many were marked approved (counts toward threshold)
 *   pending   — not yet reviewed
 */
export async function getDryRunStats(orgId: string) {
  if (!isDbConnected()) return null;

  try {
    const [total] = await db
      .select({ value: count() })
      .from(aiDrafts)
      .where(and(eq(aiDrafts.organizationId, orgId), eq(aiDrafts.isDryRun, true)));

    const [approved] = await db
      .select({ value: count() })
      .from(aiDrafts)
      .where(and(
        eq(aiDrafts.organizationId, orgId),
        eq(aiDrafts.isDryRun, true),
        eq(aiDrafts.dryRunApproved, true),
      ));

    const [pending] = await db
      .select({ value: count() })
      .from(aiDrafts)
      .where(and(
        eq(aiDrafts.organizationId, orgId),
        eq(aiDrafts.isDryRun, true),
        eq(aiDrafts.dryRunApproved, null as unknown as boolean),
      ));

    const settings = await db
      .select({ dryRunEnabled: aiSettings.dryRunEnabled, autoSendEnabled: aiSettings.autoSendEnabled })
      .from(aiSettings)
      .where(eq(aiSettings.organizationId, orgId))
      .limit(1)
      .then(r => r[0] ?? null);

    return {
      total:           total?.value ?? 0,
      approved:        approved?.value ?? 0,
      pending:         pending?.value ?? 0,
      dryRunEnabled:   settings?.dryRunEnabled ?? false,
      autoSendEnabled: settings?.autoSendEnabled ?? false,
    };
  } catch (error) {
    console.error("Failed to fetch dry-run stats:", error);
    return null;
  }
}

/**
 * Lists dry-run drafts for an org, newest first.
 * Includes the thread subject for display.
 */
export async function listDryRunDrafts(orgId: string, limit = 50) {
  if (!isDbConnected()) return [];

  try {
    return await db.query.aiDrafts.findMany({
      where: and(
        eq(aiDrafts.organizationId, orgId),
        eq(aiDrafts.isDryRun, true),
      ),
      with: { thread: { columns: { id: true, subject: true, fromEmail: true } } },
      orderBy: [desc(aiDrafts.generatedAt)],
      limit,
    });
  } catch (error) {
    console.error("Failed to list dry-run drafts:", error);
    return [];
  }
}

/**
 * Lists internal notes for a target.
 */
export async function listAdminNotes(targetId: string, type: "user" | "organization") {
  if (!isDbConnected()) return [];

  try {
    return await db.select()
      .from(adminNotes)
      .where(
        type === "user" 
          ? eq(adminNotes.targetClerkUserId, targetId) 
          : eq(adminNotes.targetOrganizationId, targetId)
      )
      .orderBy(desc(adminNotes.createdAt));
  } catch (error) {
    console.error("Failed to list admin notes:", error);
    return [];
  }
}

/**
 * Lists admin audit logs.
 */
export async function listAdminAuditLogs(limit = 200) {
  if (!isDbConnected()) return [];

  try {
    return await db.select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to list admin audit logs:", error);
    return [];
  }
}

/**
 * Lists inboxes with status="error" across all organizations, newest first.
 */
export async function listFailedInboxes(limit = 50) {
  if (!isDbConnected()) return [];

  try {
    return await db.select({
      id:           inboxes.id,
      email:        inboxes.email,
      displayName:  inboxes.displayName,
      provider:     inboxes.provider,
      lastSyncedAt: inboxes.lastSyncedAt,
      updatedAt:    inboxes.updatedAt,
      orgName:      organizations.name,
      organizationId: inboxes.organizationId,
    })
      .from(inboxes)
      .innerJoin(organizations, eq(inboxes.organizationId, organizations.id))
      .where(eq(inboxes.status, "error"))
      .orderBy(desc(inboxes.updatedAt))
      .limit(limit);
  } catch (error) {
    console.error("Failed to list failed inboxes:", error);
    return [];
  }
}

/**
 * Writes an entry to the admin audit log.
 */
export async function writeAdminAuditLog(data: {
  actorClerkUserId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetClerkUserId?: string;
  targetOrganizationId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isDbConnected()) return;

  try {
    await db.insert(adminAuditLogs).values({
      ...data,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to write admin audit log:", error);
  }
}
