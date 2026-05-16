"use client";

/**
 * Right-panel thread viewer for the split-pane inbox.
 * Fetches thread + messages + drafts + notes client-side when threadId changes.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import { DraftActions } from "../thread/[id]/DraftActions";
import { GenerateDraftButton } from "../thread/[id]/GenerateDraftButton";
import { InternalNotes, type Note } from "../thread/[id]/InternalNotes";
import { SnoozeButton } from "../thread/[id]/SnoozeButton";
import { TagEditor } from "../thread/[id]/TagEditor";
import { BlockSenderButton } from "../thread/[id]/BlockSenderButton";

// ── Minimal local types (mirrors DB schema shapes we need) ────────────────────

type Thread = {
  id: string;
  subject: string | null;
  fromEmail: string;
  fromName: string | null;
  status: string;
  caseTypeSlug: string | null;
  interactionCount: number;
  collectedInfo: Record<string, unknown>;
  snoozedUntil: Date | null;
  tags: string[];
};

type Message = {
  id: string;
  role: "customer" | "assistant" | "agent";
  bodyText: string | null;
  sentAt: string | Date;
};

type DraftStatus = "pending" | "approved" | "edited" | "sent" | "rejected";

type Draft = {
  id: string;
  action: "ask" | "summarize" | "escalate";
  status: DraftStatus;
  bodyText: string | null;
  metadata: Record<string, unknown> | null;
  aiModel: string;
  generatedAt: string | Date;
  sentAt: string | Date | null;
};

const STATUS_CLASSES: Record<string, string> = {
  open:      "bg-green-500/15 text-green-400 border-green-500/30",
  waiting:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  escalated: "bg-red-500/15 text-red-400 border-red-500/30",
  resolved:  "bg-white/10 text-muted-foreground border-white/15",
};

// ── Component ─────────────────────────────────────────────────────────────────

import { useI18n } from "@/lib/i18n/context";

export function ThreadPanel({
  threadId,
  canGenerate,
  onBack,
}: {
  threadId:    string;
  canGenerate: boolean;
  /** Optional callback for mobile back-to-list button */
  onBack?:     () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [thread,   setThread]   = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts,   setDrafts]   = useState<Draft[]>([]);
  const [notes,    setNotes]    = useState<Note[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [threadRes, notesRes] = await Promise.all([
        fetch(`/api/app/threads/${threadId}`),
        fetch(`/api/app/threads/${threadId}/notes`),
      ]);

      // Thread fetch is critical — fail loudly
      if (!threadRes.ok) throw new Error(t("inbox.thread.statusLabels.loadError"));
      const td = await threadRes.json();
      setThread(td.thread);
      setMessages(td.messages ?? []);
      setDrafts(td.drafts ?? []);

      // Notes are non-critical — degrade gracefully if they fail
      if (notesRes.ok) {
        try {
          const nd = await notesRes.json();
          setNotes((nd.notes ?? []).map((n: Note & { createdAt: string }) => ({
            ...n,
            createdAt: new Date(n.createdAt),
          })));
        } catch (notesErr) {
          console.warn("[ThreadPanel] notes parse failed:", notesErr);
          setNotes([]);
        }
      } else {
        console.warn("[ThreadPanel] notes fetch failed, status:", notesRes.status);
        setNotes([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [threadId, t]);

  // Reload when threadId changes or after a router.refresh()
  useEffect(() => { load(); }, [load]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header skeleton */}
        <div className="shrink-0 px-6 py-4 border-b border-white/8 space-y-3">
          <div className="space-y-2">
            <div className="h-4 w-2/3 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="h-6 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
          </div>
        </div>

        {/* Body skeleton */}
        <div className="flex-1 px-6 py-5 space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
            <div className="h-2.5 w-16 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="rounded-2xl border border-primary/10 bg-primary/[0.02] p-4 ml-8 space-y-2">
            <div className="h-2.5 w-16 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <p className="text-sm text-white/70 text-center max-w-[280px]">{error ?? t("inbox.thread.statusLabels.notFound")}</p>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/[0.04] hover:border-white/20 transition-colors"
        >
          {t("inbox.thread.statusLabels.tryAgain")}
        </button>
      </div>
    );
  }

  const templateVars: Record<string, string> = {
    customer_name: thread.fromName ?? "",
    from_email:    thread.fromEmail,
    case_type:     thread.caseTypeSlug ?? "",
    ...Object.fromEntries(
      Object.entries(thread.collectedInfo ?? {}).map(([k, v]) => [k, String(v)])
    ),
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 md:px-6 py-4 border-b border-white/8 bg-[hsl(var(--surface-base))]/80 backdrop-blur-md space-y-3">
        <div className="flex items-start justify-between gap-3">
          {/* Mobile back button */}
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Tillbaka till listan"
              className="md:hidden shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.05] -ml-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white truncate tracking-tight">
              {thread.subject ?? t("inbox.noSubject")}
            </h2>
            <p className="text-xs text-white/45 mt-1 flex items-center gap-1.5 flex-wrap">
              {thread.fromName
                ? <span><span className="text-white/80">{thread.fromName}</span> <span className="text-white/30">&lt;{thread.fromEmail}&gt;</span></span>
                : <span>{thread.fromEmail}</span>}
              <span className="text-white/15">·</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${STATUS_CLASSES[thread.status] ?? STATUS_CLASSES.resolved}`}>
                {thread.status}
              </span>
              {thread.caseTypeSlug && (
                <>
                  <span className="text-white/15">·</span>
                  <span>{thread.caseTypeSlug}</span>
                </>
              )}
            </p>
          </div>
          <Link
            href={`/app/thread/${thread.id}`}
            aria-label={t("inbox.thread.statusLabels.open")}
            className="shrink-0 inline-flex items-center gap-1.5 h-7 text-[10px] text-white/45 hover:text-white transition-colors border border-white/10 hover:border-white/20 hover:bg-white/[0.04] rounded-lg px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("inbox.thread.statusLabels.open")}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Snooze + Block */}
        <div className="flex items-center gap-3 flex-wrap">
          <SnoozeButton threadId={thread.id} snoozedUntil={thread.snoozedUntil ? new Date(thread.snoozedUntil) : null} />
          <BlockSenderButton fromEmail={thread.fromEmail} />
        </div>

        {/* Tags */}
        <TagEditor threadId={thread.id} initialTags={thread.tags ?? []} />
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">

        {/* Conversation */}
        {messages.map(m => (
          <div
            key={m.id}
            className={`rounded-2xl border p-4 transition-colors ${
              m.role === "customer"
                ? "border-white/8 bg-[hsl(var(--surface-elev-1))]/70"
                : m.role === "assistant"
                  ? "border-primary/20 bg-primary/[0.04] ml-8"
                  : "border-cyan-500/20 bg-cyan-500/[0.04] ml-8"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${
                m.role === "customer"  ? "text-white/45"
                : m.role === "assistant" ? "text-primary/80"
                : "text-cyan-300/80"
              }`}>
                {m.role === "customer" ? t("inbox.thread.roles.customer") : m.role === "assistant" ? t("inbox.thread.roles.ai") : t("inbox.thread.roles.agent")}
              </span>
              <span className="text-[10px] text-white/35 tabular-nums">
                {new Date(m.sentAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE")}
              </span>
            </div>
            <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{m.bodyText}</p>
          </div>
        ))}

        {/* Internal notes */}
        <InternalNotes threadId={thread.id} initial={notes} />

        {/* Draft action area */}
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{t("inbox.thread.draft")}</p>
              <p className="text-xs text-white/45 mt-1 leading-relaxed">
                {canGenerate ? t("inbox.thread.statusLabels.canGenerate") : t("inbox.thread.statusLabels.limitReached")}
              </p>
            </div>
            {canGenerate && (
              <GenerateDraftButton
                threadId={thread.id}
                onDone={() => { load(); router.refresh(); }}
              />
            )}
          </div>
        </div>

        {/* Drafts */}
        {drafts.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
              {t("inbox.thread.statusLabels.drafts")} <span className="tabular-nums text-white/30">({drafts.length})</span>
            </p>
            {drafts.map(d => (
              <div key={d.id} className="rounded-2xl border border-primary/15 bg-primary/[0.03] backdrop-blur-sm p-5 space-y-3 shadow-[0_2px_24px_-12px_hsl(189_94%_43%/0.3)]">
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionBadge action={d.action} t={t} />
                  <span className="text-[9px] text-white/45 uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/8">{d.status}</span>
                  <span className="ml-auto text-[10px] text-white/35 tabular-nums">
                    {new Date(d.generatedAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE")}
                  </span>
                </div>

                {d.bodyText && (
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{d.bodyText}</p>
                )}

                {d.action === "summarize" && d.metadata && (
                  <div className="border-t border-white/5 pt-3 space-y-1">
                    <p className="text-[10px] text-white/45 uppercase tracking-widest font-semibold">{t("inbox.thread.statusLabels.summary")}</p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {String((d.metadata as Record<string, unknown>).summary ?? "")}
                    </p>
                  </div>
                )}

                {d.action === "escalate" && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2">
                    <p className="text-xs text-red-300 leading-relaxed">
                      {String(d.metadata?.reason ?? t("inbox.thread.actions.escalate"))}
                    </p>
                  </div>
                )}

                <DraftActions
                  draftId={d.id}
                  action={d.action}
                  status={d.status}
                  initialBody={d.bodyText}
                  templateVars={templateVars}
                  onDone={() => { load(); router.refresh(); }}
                />

                <p className="text-[10px] text-white/35 border-t border-white/5 pt-2 tabular-nums">
                  <span className="opacity-60">{d.aiModel}</span>
                  {d.status === "sent" && d.sentAt && <> · {t("inbox.thread.statusLabels.sent", { time: new Date(d.sentAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE") })}</>}
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

function ActionBadge({ action, t }: { action: "ask" | "summarize" | "escalate"; t: any }) {
  const map = {
    ask:       { label: t("inbox.thread.actions.ask"),     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    summarize: { label: t("inbox.thread.actions.summarize"),   cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    escalate:  { label: t("inbox.thread.actions.escalate"),  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const v = map[action];
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${v.cls}`}>
      {v.label}
    </span>
  );
}
