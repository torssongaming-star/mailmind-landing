import { db, isDbConnected } from "@/lib/db";
import { 
  users, 
  organizations, 
  subscriptions, 
  adminCustomerProfiles, 
  adminNotes, 
  adminAuditLogs,
  adminKnowledgeArticles
} from "@/lib/db/schema";
import { desc, eq, count, sql, and, or, ilike } from "drizzle-orm";

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
    if (options?.category) filters.push(eq(adminKnowledgeArticles.category, options.category as any));

    if (filters.length > 0) {
      // @ts-ignore
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
          eq(adminKnowledgeArticles.id, idOrSlug as any),
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
 * Gets detailed info for an organization.
 */
export async function getAdminOrganization(id: string) {
  if (!isDbConnected()) return null;

  try {
    return await db.query.organizations.findFirst({
      where: eq(organizations.id, id),
      with: {
        users: true,
        subscriptions: true,
        licenseEntitlement: true,
        usageCounters: true,
      },
    });
  } catch (error) {
    console.error("Failed to get admin organization:", error);
    return null;
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
export async function listAdminAuditLogs() {
  if (!isDbConnected()) return [];

  try {
    return await db.select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(200);
  } catch (error) {
    console.error("Failed to list admin audit logs:", error);
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
  metadata?: any;
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
