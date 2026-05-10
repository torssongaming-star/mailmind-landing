import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminIdentity } from "@/lib/admin/auth";
import { getKnowledgeArticle } from "@/lib/admin/queries";
import { db } from "@/lib/db";
import { adminKnowledgeArticles, adminAuditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/knowledge/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const article = await getKnowledgeArticle(id);
    if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(article);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

/**
 * PATCH /api/admin/knowledge/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const admin = await getAdminIdentity();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const data = await req.json();

    const [updated] = await db.update(adminKnowledgeArticles)
      .set({
        ...data,
        updatedByClerkUserId: admin.clerkUserId,
        updatedByEmail: admin.email,
        updatedAt: new Date(),
        publishedAt: data.status === "published" ? new Date() : undefined,
        archivedAt: data.status === "archived" ? new Date() : undefined,
      })
      .where(eq(adminKnowledgeArticles.id, id))
      .returning();

    await db.insert(adminAuditLogs).values({
      actorClerkUserId: admin.clerkUserId,
      actorEmail: admin.email || "unknown",
      action: "knowledge_article_updated",
      targetType: "knowledge_article",
      metadata: { articleId: id, status: data.status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("API Knowledge PATCH error:", error);
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}
