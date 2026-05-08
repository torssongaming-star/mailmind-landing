"use client";

import { useState } from "react";
import { KNOWLEDGE_BASE } from "@/lib/admin/knowledge";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export default function AdminKnowledgePage() {
  const [selectedId, setSelectedId] = useState(KNOWLEDGE_BASE[0].id);
  const selectedArticle = KNOWLEDGE_BASE.find(a => a.id === selectedId) || KNOWLEDGE_BASE[0];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-[#050B1C]/50">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-white font-bold flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            Knowledge Base
          </h1>
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search articles..." 
              className="w-full bg-[#030614] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:border-primary/50 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {["Processes", "Security", "Checklists"].map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-2">{cat}</h3>
              <div className="space-y-1">
                {KNOWLEDGE_BASE.filter(a => a.category === cat).map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedId(article.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all group flex items-center justify-between",
                      selectedId === article.id 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {article.title}
                    <ChevronRight className={cn(
                      "w-3 h-3 transition-transform",
                      selectedId === article.id ? "translate-x-0" : "-translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                    )} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#030614]">
        <div className="max-w-3xl mx-auto p-12">
          <div className="mb-8">
            <span className="text-primary text-[10px] font-bold uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
              {selectedArticle.category}
            </span>
            <h2 className="text-white text-4xl font-bold tracking-tight mt-4">{selectedArticle.title}</h2>
          </div>

          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight prose-strong:text-primary prose-a:text-primary hover:prose-a:text-cyan-300">
            <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
