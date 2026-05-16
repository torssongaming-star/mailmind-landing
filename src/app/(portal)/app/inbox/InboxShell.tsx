"use client";

/**
 * Split-pane inbox shell.
 * Left:  compact thread list (fixed width, scrollable)
 * Right: ThreadPanel (flex-1, scrollable independently)
 *
 * Both panels fill the viewport height. Selecting a thread never navigates —
 * the panel loads the content client-side for instant feel.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ThreadPanel } from "./ThreadPanel";

type Thread = {
  id:            string;
  subject:       string | null;
  fromEmail:     string;
  fromName:      string | null;
  status:        string;
  caseTypeSlug:  string | null;
  lastMessageAt: Date | null;
  snoozedUntil:  Date | null;
  tags:          string[];
};

const STATUS_DOT: Record<string, string> = {
  open:      "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]",
  waiting:   "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
  escalated: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]",
  resolved:  "bg-white/20",
};

const STATUS_DOT_ANIMATED: Record<string, boolean> = {
  open: true,
  waiting: false,
  escalated: false,
  resolved: false,
};

const POLL_MS = 30_000;

import { useI18n } from "@/lib/i18n/context";

export function InboxShell({
  threads,
  canGenerate,
  slaByCaseType = {},
}: {
  threads:       Thread[];
  canGenerate:   boolean;
  slaByCaseType?: Record<string, number>;
}) {
  const { t, locale } = useI18n();
  const router  = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    threads.length > 0 ? threads[0].id : null
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<"resolve" | "escalate" | "delete" | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-select first thread if current selection disappears after refresh
  useEffect(() => {
    if (selectedId && threads.some(t => t.id === selectedId)) return;
    setSelectedId(threads[0]?.id ?? null);
  }, [threads, selectedId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const formattedDates = useMemo(
    () => Object.fromEntries(threads.map(t => [
      t.id,
      t.lastMessageAt
        ? new Date(t.lastMessageAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE", { dateStyle: "short", timeStyle: "short" })
        : "—",
    ])),
    [threads, locale]
  );

  const allSelected = threads.length > 0 && selected.size === threads.length;
  const someSelected = selected.size > 0 && !allSelected;

  const handleBulk = async (action: "resolve" | "escalate" | "delete") => {
    if (selected.size === 0 || pendingAction) return;
    if (action === "delete" && !confirm(t("inbox.bulk.deleteConfirm", { count: selected.size.toString() }))) return;
    setPendingAction(action);
    setBulkError(null);
    try {
      const res = await fetch("/api/app/threads/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ threadIds: Array.from(selected), action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("common.error"));
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel — thread list ───────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-white/8 overflow-hidden">

        {/* List toolbar */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-white/[0.01]">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onChange={() => setSelected(allSelected ? new Set() : new Set(threads.map(t => t.id)))}
            className="rounded cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground flex-1">
            {threads.length} {t("inbox.title").toLowerCase()}
          </span>
          <button
            onClick={refresh}
            disabled={refreshing}
            title={t("inbox.status.updatedAt", { time: lastRefresh.toLocaleTimeString(locale === "sv" ? "sv-SE" : "en-IE") })}
            aria-label={locale === "sv" ? "Uppdatera" : "Refresh"}
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary/5 border-b border-primary/20 flex-wrap">
            <span className="text-[10px] text-white font-semibold">{selected.size} {t("inbox.bulk.selected")}</span>
            <button onClick={() => setSelected(new Set())} className="text-[10px] text-muted-foreground hover:text-white ml-1">{t("inbox.bulk.clear")}</button>
            {bulkError && <span className="text-[10px] text-red-400">{bulkError}</span>}
            <div className="flex-1" />
            <button onClick={() => handleBulk("resolve")} disabled={!!pendingAction} className="text-[10px] px-2 py-1 rounded-md bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40 transition-colors">
              {pendingAction === "resolve" ? "…" : t("inbox.thread.actions.summarize")}
            </button>
            <button onClick={() => handleBulk("escalate")} disabled={!!pendingAction} className="text-[10px] px-2 py-1 rounded-md bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors">
              {pendingAction === "escalate" ? "…" : t("inbox.thread.actions.escalate")}
            </button>
            <button onClick={() => handleBulk("delete")} disabled={!!pendingAction} className="text-[10px] px-2 py-1 rounded-md border border-white/10 text-muted-foreground hover:text-white disabled:opacity-40 transition-colors">
              {pendingAction === "delete" ? "…" : t("inbox.bulk.delete")}
            </button>
          </div>
        )}

        {/* Thread rows */}
        <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
          {threads.length === 0 && (
            <li className="px-6 py-10 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/8 flex items-center justify-center mb-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p className="text-xs text-white/45">{t("inbox.thread.statusLabels.noMatch")}</p>
              <p className="text-[10px] text-white/25 max-w-[200px] leading-relaxed">
                {locale === "sv"
                  ? "När kunder skriver till en kopplad inkorg dyker trådar upp här."
                  : "Threads appear here when customers email a connected inbox."}
              </p>
            </li>
          )}
          {threads.map(thread => {
            const isSelected  = selectedId === thread.id;
            const isChecked   = selected.has(thread.id);
            const slaHours    = thread.caseTypeSlug ? slaByCaseType[thread.caseTypeSlug] : undefined;
            let slaBreached   = false;
            if (slaHours && thread.lastMessageAt) {
              slaBreached = (Date.now() - new Date(thread.lastMessageAt).getTime()) / 3_600_000 >= slaHours;
            }
            return (
              <li
                key={thread.id}
                onClick={() => setSelectedId(thread.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(thread.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${thread.fromName ?? thread.fromEmail} — ${thread.subject ?? t("inbox.noSubject")}`}
                className={[
                  "flex items-start gap-2.5 px-3 py-3 cursor-pointer transition-colors",
                  "focus-visible:outline-none focus-visible:bg-white/[0.04]",
                  isSelected
                    ? "bg-primary/10 border-l-2 border-primary"
                    : "hover:bg-white/[0.03] border-l-2 border-transparent",
                ].join(" ")}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => setSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(thread.id)) next.delete(thread.id);
                    else next.add(thread.id);
                    return next;
                  })}
                  onClick={e => e.stopPropagation()}
                  aria-label={`Markera ${thread.fromName ?? thread.fromEmail}`}
                  className="rounded cursor-pointer mt-0.5 shrink-0"
                />

                {/* Status dot — animated pulse on "open" threads */}
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_DOT[thread.status] ?? STATUS_DOT.resolved} ${STATUS_DOT_ANIMATED[thread.status] ? "animate-pulse-soft" : ""}`}
                  aria-hidden
                />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className={`text-xs font-semibold truncate ${isSelected ? "text-white" : "text-white/80"}`}>
                    {thread.fromName ?? thread.fromEmail}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {thread.subject ?? t("inbox.noSubject")}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {thread.caseTypeSlug && (
                      <span className="text-[9px] text-white/30">{thread.caseTypeSlug}</span>
                    )}
                    {thread.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {tag}
                      </span>
                    ))}
                    {slaBreached && (
                      <span className="text-[9px] font-bold text-red-400">SLA</span>
                    )}
                    {thread.snoozedUntil && new Date(thread.snoozedUntil) > new Date() && (
                      <span className="text-[9px] text-amber-400">{t("inbox.status.snoozed").toLowerCase()}</span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <span className="shrink-0 text-[9px] text-muted-foreground tabular-nums mt-0.5">
                  {formattedDates[thread.id]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Right panel — thread content ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedId ? (
          <ThreadPanel
            key={selectedId}
            threadId={selectedId}
            canGenerate={canGenerate}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="relative">
              {/* Soft glow behind icon */}
              <div className="absolute inset-0 blur-2xl bg-primary/10 rounded-full" aria-hidden />
              <div className="relative w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/80">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
            </div>
            <div className="text-center max-w-[280px]">
              <p className="text-sm font-medium text-white/70">{t("inbox.thread.statusLabels.selectThread")}</p>
              {threads.length > 0 && (
                <p className="text-xs text-white/35 mt-1.5 leading-relaxed">
                  {locale === "sv"
                    ? "Välj en tråd till vänster för att se konversation, AI-utkast och åtgärder."
                    : "Pick a thread on the left to see the conversation, AI drafts and actions."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
