import { getKnowledgeArticle } from "@/lib/admin/queries";
import { KnowledgeEditor } from "@/components/admin/KnowledgeEditor";
import { notFound } from "next/navigation";

export default async function EditKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getKnowledgeArticle(id);

  if (!article) notFound();

  return <KnowledgeEditor article={article} />;
}
