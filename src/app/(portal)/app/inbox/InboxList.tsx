"use client";

import { useState, useMemo } from "react";
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
};

const STATUS_CLASSES: Record<string, string> = {
  open:      "bg-green-500/15 text-green-400 border-green-500/30",
  waiting:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  escalated: "bg-red-500/15 text-red-400 border-red-500/30",
  resolved:  "bg-white/10 text-muted-foreground border-white/15",
};

export function InboxList({ threads }: { threads: Thread[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<"resolve" | "escalate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = threads.length > 0 && selected.size === threads.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(threads.map(t => t.id)));
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

    if (action === "delete" && !confirm(`Delete ${selected.size} thread${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) {
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
    () => Object.fromEntries(threads.map(t => [
      t.id,
      t.lastMessageAt
        ? new Date(t.lastMessageAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })
        : "—",
    ])),
    [threads]
  );

  return (
    <div className="space-y-3">
      {/* Bulk action bar — slides in when something is selected */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-10 rounded-2xl border border-primary/30 bg-[#050B1C]/95 backdrop-blur-md px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <span className="text-sm text-white">
            <span className="font-semibold">{selectedCount}</span> selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-white"
          >
            Clear
          </button>
          {error && <span className="text-xs text-red-400 ml-2">{error}</span>}
          <div className="flex-1" />
          <button
            onClick={() => handleBulk("resolve")}
            disabled={!!pendingAction}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-40"
          >
            {pendingAction === "resolve" ? "Resolving…" : "Mark resolved"}
          </button>
          <button
            onClick={() => handleBulk("escalate")}
            disabled={!!pendingAction}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-40"
          >
            {pendingAction === "escalate" ? "Escalating…" : "Escalate"}
          </button>
          <button
            onClick={() => handleBulk("delete")}
            disabled={!!pendingAction}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
          >
            {pendingAction === "delete" ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

      <ul className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm divide-y divide-white/5 overflow-hidden">
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
          <span>{threads.length} thread{threads.length === 1 ? "" : "s"}</span>
        </li>

        {threads.map(t => {
          const isSelected = selected.has(t.id);
          return (
            <li
              key={t.id}
              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                isSelected ? "bg-primary/[0.06]" : "hover:bg-white/[0.03]"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(t.id)}
                onClick={e => e.stopPropagation()}
                className="rounded cursor-pointer shrink-0"
                aria-label={`Select ${t.subject ?? t.fromEmail}`}
              />
              <Link
                href={`/app/thread/${t.id}`}
                className="flex-1 min-w-0 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {t.subject ?? "(no subject)"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.fromName ? `${t.fromName} ` : ""}
                    <span className="text-white/30">&lt;{t.fromEmail}&gt;</span>
                    {t.caseTypeSlug && <> · <span className="text-white/40">{t.caseTypeSlug}</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    STATUS_CLASSES[t.status] ?? STATUS_CLASSES.resolved
                  }`}>
                    {t.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formattedDates[t.id]}
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
