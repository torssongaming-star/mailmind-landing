import { listKnowledgeArticles } from "@/lib/admin/queries";
import { BookOpen, Plus, Edit, Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { KnowledgeFilters } from "@/components/admin/KnowledgeFilters";
import { cn } from "@/lib/utils";
import { AdminKnowledgeArticle } from "@/lib/db/schema";

export default async function AdminKnowledgeListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}) {
  const { q, status, category } = await searchParams;
  
  let articles: AdminKnowledgeArticle[] = await listKnowledgeArticles({ 
    status: (status === "all" ? undefined : status) as AdminKnowledgeArticle["status"], 
    category: (category === "all" ? undefined : category)
  });

  if (q) {
    const searchLower = q.toLowerCase();
    articles = articles.filter(a => 
      a.title.toLowerCase().includes(searchLower) || 
      a.content.toLowerCase().includes(searchLower) ||
      (a.summary && a.summary.toLowerCase().includes(searchLower))
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight mb-2">Knowledge Base</h1>
          <p className="text-slate-400 text-sm">Manage internal documentation and guides.</p>
        </div>
        
        <Link 
          href="/admin/knowledge/new"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/10 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
      </div>

      <KnowledgeFilters />

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Article</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Author</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Updated</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {articles.map((article: AdminKnowledgeArticle) => (
                <tr key={article.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                        <BookOpen className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-sm font-medium leading-none mb-1">{article.title}</span>
                        <span className="text-slate-500 text-[10px] font-mono">{article.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-widest border border-white/10">
                      {article.category.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      article.status === "published" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                      article.status === "draft" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                      "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {article.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-slate-300 text-xs">{article.authorEmail?.split("@")[0]}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {format(new Date(article.updatedAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link 
                        href={`/admin/knowledge/${article.id}`}
                        className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link 
                        href={`/admin/knowledge/${article.id}/edit`}
                        className="p-2 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {articles.map((article: AdminKnowledgeArticle) => (
          <div key={article.id} className="bg-[#050B1C] border border-white/5 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                  <BookOpen className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-white text-sm font-bold truncate">{article.title}</span>
                  <span className="text-slate-500 text-[10px] font-mono truncate">{article.slug}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Category</span>
                <span className="text-slate-200 text-xs truncate">
                  {article.category.replace("_", " ")}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Status</span>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  article.status === "published" ? "text-green-500" :
                  article.status === "draft" ? "text-yellow-500" :
                  "text-red-500"
                )}>
                  {article.status}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
               <div className="flex flex-col">
                  <span className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Updated</span>
                  <span className="text-slate-400 text-[10px]">{format(new Date(article.updatedAt), "MMM d, yyyy")}</span>
               </div>
               <div className="flex gap-2">
                  <Link 
                    href={`/admin/knowledge/${article.id}`}
                    className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link 
                    href={`/admin/knowledge/${article.id}/edit`}
                    className="p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
               </div>
            </div>
          </div>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-800 mx-auto mb-4" />
          <p className="text-slate-500 text-sm italic">No articles found. Create your first guide.</p>
        </div>
      )}
    </div>
  );
}
