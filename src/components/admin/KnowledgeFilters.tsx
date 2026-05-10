"use client";

import { Search, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";

export function KnowledgeFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set("q", debouncedSearch);
    } else {
      params.delete("q");
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearch, pathname, router, searchParams]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center justify-between w-full">
      <div className="flex gap-4 flex-1 max-w-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search articles..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#050B1C] border border-white/10 rounded-xl pl-10 pr-10 py-2 text-sm text-white focus:border-primary/50 outline-none transition-all"
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        <select 
          value={searchParams.get("category") || "all"}
          onChange={(e) => handleFilterChange("category", e.target.value)}
          className="bg-[#050B1C] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 outline-none focus:border-primary/50 transition-all cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="enterprise">Enterprise</option>
          <option value="gdpr">GDPR</option>
          <option value="security">Security</option>
          <option value="dpa">DPA</option>
          <option value="ai_policy">AI Policy</option>
          <option value="pilot">Pilot</option>
          <option value="support">Support</option>
          <option value="billing">Billing</option>
          <option value="onboarding">Onboarding</option>
          <option value="internal_process">Internal Process</option>
          <option value="other">Other</option>
        </select>

        <select 
          value={searchParams.get("status") || "all"}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="bg-[#050B1C] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 outline-none focus:border-primary/50 transition-all cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>
  );
}
