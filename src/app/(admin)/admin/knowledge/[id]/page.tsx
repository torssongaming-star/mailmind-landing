import { getKnowledgeArticle } from "@/lib/admin/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Edit, User, Tag, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default async function KnowledgeArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getKnowledgeArticle(id);

  if (!article) notFound();

  return (
    <div className="min-h-screen bg-[#030614]">
      {/* Header */}
      <div className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-[#050B1C]/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link 
            href="/admin/knowledge"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-white/5 mx-2" />
          <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">{article.category.replace("_", " ")}</span>
        </div>

        <Link
          href={`/admin/knowledge/${article.id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10"
        >
          <Edit className="w-4 h-4" />
          Edit Article
        </Link>
      </div>

      <main className="max-w-4xl mx-auto p-12 space-y-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <span className={cn(
               "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
               article.status === "published" ? "bg-green-500/10 text-green-500 border-green-500/20" :
               article.status === "draft" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
               "bg-red-500/10 text-red-500 border-red-500/20"
             )}>
               {article.status}
             </span>
             {article.publishedAt && (
               <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                 Published {format(new Date(article.publishedAt), "MMM d, yyyy")}
               </span>
             )}
          </div>

          <h1 className="text-white text-5xl font-bold tracking-tight leading-tight">
            {article.title}
          </h1>

          {article.summary && (
            <p className="text-slate-400 text-xl font-medium leading-relaxed border-l-2 border-primary/30 pl-6 italic">
              {article.summary}
            </p>
          )}

          <div className="flex flex-wrap gap-8 py-4 border-y border-white/5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <div className="flex flex-col">
                <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest leading-none mb-1">Author</span>
                <span className="text-slate-300 text-sm">{article.authorEmail}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <div className="flex flex-col">
                <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest leading-none mb-1">Last Updated</span>
                <span className="text-slate-300 text-sm">{format(new Date(article.updatedAt), "PPP")}</span>
              </div>
            </div>
            {article.tags && article.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-500" />
                <div className="flex flex-wrap gap-1">
                  {article.tags?.map((tag: string) => (
                    <span key={tag} className="text-primary text-[10px] font-bold">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight prose-strong:text-primary prose-a:text-primary hover:prose-a:text-cyan-300 prose-img:rounded-2xl">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
