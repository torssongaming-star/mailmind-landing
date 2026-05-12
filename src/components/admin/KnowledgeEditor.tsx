"use client";

import { useState, useTransition } from "react";
import { upsertKnowledgeArticleAction } from "@/lib/admin/actions";
import { useRouter } from "next/navigation";
import { Save, Send, Archive, ChevronLeft, Eye, Loader2, Edit } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { AdminKnowledgeArticle } from "@/lib/db/schema";

interface KnowledgeEditorProps {
  article?: AdminKnowledgeArticle;
}

const categories = [
  { value: "enterprise", label: "Enterprise" },
  { value: "gdpr", label: "GDPR" },
  { value: "security", label: "Security" },
  { value: "dpa", label: "DPA" },
  { value: "ai_policy", label: "AI Policy" },
  { value: "pilot", label: "Pilot" },
  { value: "support", label: "Support" },
  { value: "billing", label: "Billing" },
  { value: "onboarding", label: "Onboarding" },
  { value: "internal_process", label: "Internal Process" },
  { value: "other", label: "Other" },
];

export function KnowledgeEditor({ article }: KnowledgeEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);

  const [formData, setFormData] = useState({
    title: article?.title || "",
    slug: article?.slug || "",
    summary: article?.summary || "",
    content: article?.content || "",
    category: article?.category || "other",
    status: article?.status || "draft",
    tags: article?.tags || [],
  });

  const handleSave = (statusOverride?: "draft" | "published" | "archived") => {
    startTransition(async () => {
      const result = await upsertKnowledgeArticleAction({
        ...formData,
        id: article?.id,
        status: statusOverride || formData.status as AdminKnowledgeArticle["status"],
      });

      if (result.success) {
        router.push(`/admin/knowledge/${result.id}`);
        router.refresh();
      } else {
        alert("Failed to save: " + result.error);
      }
    });
  };

  const handleAutoSlug = (title: string) => {
    if (!article?.id) { // Only auto-gen for new articles
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormData(prev => ({ ...prev, title, slug }));
    } else {
      setFormData(prev => ({ ...prev, title }));
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-[#030614]">
      {/* Editor Header */}
      <div className="min-h-16 border-b border-white/5 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#050B1C]/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              href="/admin/knowledge"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-white/5 mx-1 sm:mx-2" />
            <h2 className="text-white text-sm sm:text-base font-bold tracking-tight truncate max-w-[150px] sm:max-w-none">
              {article?.id ? "Edit Article" : "New Article"}
            </h2>
            {formData.status && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-widest border ml-1 sm:ml-2",
                formData.status === "published" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                formData.status === "draft" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                "bg-red-500/10 text-red-500 border-red-500/20"
              )}>
                {formData.status}
              </span>
            )}
          </div>

          {/* Mobile Preview Toggle */}
          <button
            onClick={() => setPreview(!preview)}
            className="sm:hidden p-2 text-slate-400 hover:text-white active:bg-white/5 rounded-lg transition-all"
          >
            {preview ? <Edit className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setPreview(!preview)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
          >
            <Eye className="w-4 h-4" />
            {preview ? "Edit" : "Preview"}
          </button>
          
          <div className="hidden sm:block h-6 w-px bg-white/5 mx-2" />

          <button
            onClick={() => handleSave("draft")}
            disabled={isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all border border-white/10 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span className="sm:inline">Save</span>
          </button>

          <button
            onClick={() => handleSave("published")}
            disabled={isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3 h-3 sm:w-4 sm:h-4" />}
            Publish
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Article Title"
                value={formData.title}
                onChange={(e) => handleAutoSlug(e.target.value)}
                className="w-full bg-transparent border-none text-white text-2xl sm:text-4xl font-bold placeholder:text-slate-800 focus:ring-0 p-0 outline-none"
              />
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-slate-500 text-[10px] sm:text-sm font-mono bg-white/[0.02] p-2 rounded-lg border border-white/5">
                <span className="hidden sm:inline">mailmind.se/admin/knowledge/</span>
                <span className="sm:hidden text-slate-600">/admin/knowledge/</span>
                <input 
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="bg-transparent border-none p-0 focus:ring-0 text-primary outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">Summary</label>
              <textarea
                placeholder="Briefly describe what this article covers..."
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                className="w-full bg-[#050B1C] border border-white/5 rounded-xl p-4 text-slate-300 text-sm focus:border-primary/50 outline-none h-24 resize-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">Content (Markdown)</label>
              <div className="bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-2xl focus-within:border-primary/30 transition-all">
                {preview ? (
                  <div className="p-4 sm:p-8 prose prose-invert prose-sm max-w-none min-h-[500px]">
                    <ReactMarkdown>{formData.content}</ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    placeholder="Write your article here using Markdown..."
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full bg-transparent border-none p-4 sm:p-8 text-slate-300 text-sm sm:text-base font-serif leading-relaxed focus:ring-0 outline-none min-h-[500px] resize-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-8">
            <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
              <h3 className="text-white text-xs font-bold uppercase tracking-widest border-b border-white/5 pb-4">Article Settings</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as AdminKnowledgeArticle["category"] }))}
                    className="w-full bg-[#030614] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-primary/50 transition-all cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">Tags</label>
                  <input
                    type="text"
                    placeholder="Enter tags, separated by commas..."
                    className="w-full bg-[#030614] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-primary/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {article?.id && (
              <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="text-red-500/80 text-[10px] font-bold uppercase tracking-widest border-b border-white/5 pb-4">Danger Zone</h3>
                <button
                  onClick={() => handleSave("archived")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-red-500/20"
                >
                  <Archive className="w-4 h-4" />
                  Archive Article
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
