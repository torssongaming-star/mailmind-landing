"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Thread = {
  id:             string;
  subject:        string | null;
  fromEmail:      string;
  fromName:       string | null;
  status:         string;
  caseTypeSlug:   string | null;
  lastMessageAt:  Date | null;
  snoozedUntil:   Date | null;
  tags:           string[];
};

const STATUS_CLASSES: Record<string, string> = {
  open:      "bg-green-500/15 text-green-400 border-green-500/30",
  waiting:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  escalated: "bg-red-500/15 text-red-400 border-red-500/30",
  resolved:  "bg-white/10 text-muted-foreground border-white/15",
};

const POLL_INTERVAL_MS = 30_000; // 30 seconds

import { useI18n } from "@/lib/i18n/context";

export function InboxList({ threads = [], slaByCaseType = {} }: { threads: Thread[]; slaByCaseType?: Record<string, number> }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<"resolve" | "escalate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    // Brief visual feedback — reset after 1s
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  // Auto-poll every 30s
  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const allSelected = threads.length > 0 && selected.size === threads.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(threads.map(thread => thread.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulk = async (action: "resolve" | "escalate" | "delete") => {
    if (selected.size === 0 || pendingAction) return;

    if (action === "delete" && !confirm(t("inbox.bulk.deleteConfirm", { count: selected.size.toString() }))) {
      return;
    }

    setPendingAction(action);
    setError(null);
    try {
      const res = await fetch("/api/app/threads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: Array.from(selected), action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed");
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPendingAction(null);
    }
  };

  const selectedCount = selected.size;

  // Pre-compute formatted date strings (no per-render recompute)
  const formattedDates = useMemo(
    () => Object.fromEntries(threads.map(thread => [
      thread.id,
      thread.lastMessageAt
        ? new Date(thread.lastMessageAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE", { dateStyle: "short", timeStyle: "short" })
        : "—",
    ])),
    [threads, locale]
  );

  return (
    <div className="space-y-3">
      {/* Bulk action bar — slides in when something is selected */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-10 rounded-2xl border border-primary/30 bg-[hsl(var(--surface-elev-1))]/95 backdrop-blur-md px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <span className="text-sm text-white">
            <span className="font-semibold">{selectedCount}</span> {t("inbox.bulk.selected")}
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-white"
          >
            {t("inbox.bulk.clear")}
          </button>
          {error && <span className="text-xs text-red-400 ml-2">{error}</span>}
          <div className="flex-1" />
          <button
            onClick={() => handleBulk("resolve")}
            disabled={!!pendingAction}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-40"
          >
            {pendingAction === "resolve" ? t("inbox.bulk.resolving") : t("inbox.bulk.resolve")}
          </button>
          <button
            onClick={() => handleBulk("escalate")}
            disabled={!!pendingAction}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-40"
          >
            {pendingAction === "escalate" ? t("inbox.bulk.escalating") : t("inbox.bulk.escalate")}
          </button>
          <button
            onClick={() => handleBulk("delete")}
            disabled={!!pendingAction}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
          >
            {pendingAction === "delete" ? t("inbox.bulk.deleting") : t("inbox.bulk.delete")}
          </button>
        </div>
      )}

      <ul className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm divide-y divide-white/5 overflow-hidden">
        {/* Header row with select-all */}
        <li className="px-5 py-2 flex items-center gap-3 bg-white/[0.02] text-[10px] uppercase tracking-wider text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={toggleAll}
            className="rounded cursor-pointer"
            aria-label={allSelected ? "Deselect all" : "Select all"}
          />
          <span>{threads.length} {t("inbox.title").toLowerCase()}</span>
          <div className="flex-1" />
          <button
            onClick={refresh}
            disabled={refreshing}
            title={t("inbox.status.updatedAt", { time: lastRefresh.toLocaleTimeString(locale === "sv" ? "sv-SE" : "en-IE") })}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white transition-colors disabled:opacity-40"
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={refreshing ? "animate-spin" : ""}
            >
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {refreshing ? t("inbox.status.updating") : lastRefresh.toLocaleTimeString(locale === "sv" ? "sv-SE" : "en-IE", { timeStyle: "short" })}
          </button>
        </li>

        {threads.map(thread => {
          const isSelected = selected.has(thread.id);
          // SLA badge computation
          const slaHours = thread.caseTypeSlug ? slaByCaseType[thread.caseTypeSlug] : undefined;
          let slaBadge: "breached" | "warning" | null = null;
          if (slaHours && thread.lastMessageAt) {
            const elapsedHours = (Date.now() - new Date(thread.lastMessageAt).getTime()) / 3_600_000;
            if (elapsedHours >= slaHours) slaBadge = "breached";
            else if (elapsedHours >= slaHours * 0.8) slaBadge = "warning";
          }
          return (
            <li
              key={thread.id}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                isSelected ? "bg-primary/[0.06]" : "hover:bg-white/[0.03]"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(thread.id)}
                onClick={e => e.stopPropagation()}
                className="rounded cursor-pointer shrink-0"
                aria-label={`Select ${thread.subject ?? thread.fromEmail}`}
              />
              <Link
                href={`/app/thread/${thread.id}`}
                className="flex-1 min-w-0 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {thread.subject ?? t("inbox.noSubject")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {thread.fromName ? `${thread.fromName} ` : ""}
                    <span className="text-white/30">&lt;{thread.fromEmail}&gt;</span>
                    {thread.caseTypeSlug && <> · <span className="text-white/40">{thread.caseTypeSlug}</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {slaBadge === "breached" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/30">
                      {t("inbox.sla.breached")}
                    </span>
                  )}
                  {slaBadge === "warning" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
                      {t("inbox.sla.warning")}
                    </span>
                  )}
                  {thread.snoozedUntil && new Date(thread.snoozedUntil) > new Date() && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30 inline-flex items-center gap-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {t("inbox.status.snoozed")}
                    </span>
                  )}
                  {thread.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                      {tag}
                    </span>
                  ))}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    STATUS_CLASSES[thread.status] ?? STATUS_CLASSES.resolved
                  }`}>
                    {thread.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formattedDates[thread.id]}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
