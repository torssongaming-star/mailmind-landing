"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Counts = {
  all: number;
  open: number;
  waiting: number;
  escalated: number;
  resolved: number;
};

const TABS: Array<{ value: "all" | "open" | "waiting" | "escalated" | "resolved"; label: string }> = [
  { value: "all",       label: "All" },
  { value: "open",      label: "Open" },
  { value: "waiting",   label: "Waiting" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved",  label: "Resolved" },
];

export function InboxFilters({
  currentStatus,
  currentQuery,
  currentTag,
  counts,
  compact,
}: {
  currentStatus: string | null;
  currentQuery: string;
  currentTag?: string;
  counts: Counts;
  compact?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);

  // Debounced URL update on query change
  useEffect(() => {
    const handle = setTimeout(() => {
      if (query === currentQuery) return; // no-op when unchanged
      const next = new URLSearchParams(searchParams.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      router.push(`/app/inbox${next.toString() ? `?${next.toString()}` : ""}`);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, currentQuery, router, searchParams]);

  const buildHref = (status: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (status === "all") next.delete("status");
    else next.set("status", status);
    const qs = next.toString();
    return `/app/inbox${qs ? `?${qs}` : ""}`;
  };

  const clearTagHref = (() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tag");
    const qs = next.toString();
    return `/app/inbox${qs ? `?${qs}` : ""}`;
  })();

  const activeStatus = currentStatus ?? "all";

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col sm:flex-row gap-3"}>
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map(tab => {
          const isActive = activeStatus === tab.value;
          const count = counts[tab.value];
          return (
            <Link
              key={tab.value}
              href={buildHref(tab.value)}
              className={`${compact ? "px-2 py-1" : "px-3 py-1.5"} rounded-lg text-[10px] font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "bg-primary text-[#030614]"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[9px] tabular-nums ${isActive ? "opacity-70" : "opacity-50"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Active tag filter chip */}
      {currentTag && (
        <Link
          href={clearTagHref}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          #{currentTag}
          <span className="text-primary/60 hover:text-primary leading-none">×</span>
        </Link>
      )}

      {/* Search */}
      <div className="relative flex-1 sm:max-w-xs">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search subject, sender, type…"
          className="w-full bg-white/5 text-white text-xs rounded-lg pl-8 pr-3 py-1.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
