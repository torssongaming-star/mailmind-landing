"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/context";

type Counts = {
  all: number;
  open: number;
  waiting: number;
  escalated: number;
  resolved: number;
  snoozed: number;
};

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
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);

  const TABS: Array<{ value: keyof Counts; label: string }> = [
    { value: "all",       label: t("inbox.filters.all") },
    { value: "open",      label: t("inbox.filters.open") },
    { value: "waiting",   label: t("inbox.filters.waiting") },
    { value: "escalated", label: t("inbox.filters.escalated") },
    { value: "resolved",  label: t("inbox.filters.resolved") },
    { value: "snoozed",   label: t("inbox.filters.snoozed") },
  ];

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
              aria-current={isActive ? "page" : undefined}
              className={`${compact ? "px-2 py-1" : "px-3 py-1.5"} rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                isActive
                  ? "bg-primary/[0.12] text-primary border border-primary/25"
                  : "text-white/55 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] tabular-nums px-1 rounded ${isActive ? "bg-primary/15 text-primary" : "text-white/35"}`}>
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
          placeholder={t("inbox.search")}
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
            aria-label="Rensa sökning"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
