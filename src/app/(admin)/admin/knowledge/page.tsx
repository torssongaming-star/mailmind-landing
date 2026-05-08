import { listKnowledgeArticles } from "@/lib/admin/queries";
import { BookOpen, Plus, Search, Filter, ChevronRight, Edit, Eye, Archive, CheckCircle } from "lucide-react";
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
    status: (status === "all" ? undefined : status) as any, 
    category: (category === "all" ? undefined : category) as any 
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
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight mb-2">Knowledge Base</h1>
          <p className="text-slate-400">Manage internal documentation and guides.</p>
        </div>
        
        <Link 
          href="/admin/knowledge/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/10"
        >
          <Plus className="w-4 h-4" />
          New Article
        </Link>
      </div>

      <KnowledgeFilters />

      <div className="bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
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
              {articles.map((article: any) => (
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
              {articles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <BookOpen className="w-12 h-12 text-slate-800" />
                      <p className="text-slate-500 text-sm">No articles found. Create your first guide.</p>
                      <Link href="/admin/knowledge/new" className="text-primary text-xs font-bold uppercase tracking-widest mt-2 hover:underline">
                        Get Started
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
