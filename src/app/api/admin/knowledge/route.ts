import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminIdentity } from "@/lib/admin/auth";
import { listKnowledgeArticles } from "@/lib/admin/queries";
import { db } from "@/lib/db";
import { adminKnowledgeArticles, adminAuditLogs, AdminKnowledgeArticle } from "@/lib/db/schema";

/**
 * GET /api/admin/knowledge
 * Lists all articles
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminApi();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as AdminKnowledgeArticle["status"] | null;
    const category = searchParams.get("category") || undefined;

    const articles = await listKnowledgeArticles({ 
      status: status || undefined, 
      category 
    });
    return NextResponse.json(articles);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

/**
 * POST /api/admin/knowledge
 * Creates a new article
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdminApi();
    const admin = await getAdminIdentity();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const data = await req.json();

    const [newArticle] = await db.insert(adminKnowledgeArticles).values({
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      content: data.content,
      category: data.category || "other",
      status: data.status || "draft",
      tags: data.tags || [],
      authorClerkUserId: admin.clerkUserId,
      authorEmail: admin.email,
      publishedAt: data.status === "published" ? new Date() : undefined,
    }).returning();

    await db.insert(adminAuditLogs).values({
      actorClerkUserId: admin.clerkUserId,
      actorEmail: admin.email || "unknown",
      action: "knowledge_article_created",
      targetType: "knowledge_article",
      metadata: { articleId: newArticle.id, title: newArticle.title },
    });

    return NextResponse.json(newArticle);
  } catch (error) {
    console.error("API Knowledge POST error:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
