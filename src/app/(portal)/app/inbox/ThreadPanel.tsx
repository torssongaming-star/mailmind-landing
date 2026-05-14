"use client";

/**
 * Right-panel thread viewer for the split-pane inbox.
 * Fetches thread + messages + drafts + notes client-side when threadId changes.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
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
}: {
  threadId:    string;
  canGenerate: boolean;
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
      if (!threadRes.ok) throw new Error(t("inbox.thread.status.loadError"));
      const [td, nd] = await Promise.all([threadRes.json(), notesRes.json()]);
      setThread(td.thread);
      setMessages(td.messages ?? []);
      setDrafts(td.drafts ?? []);
      setNotes((nd.notes ?? []).map((n: Note & { createdAt: string }) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [threadId, t]);

  // Reload when threadId changes or after a router.refresh()
  useEffect(() => { load(); }, [load]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">{error ?? t("inbox.thread.status.notFound")}</p>
        <button onClick={load} className="text-xs text-primary hover:text-white transition-colors">
          {t("inbox.thread.status.tryAgain")}
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
      <div className="shrink-0 px-6 py-4 border-b border-white/8 bg-[#030614]/80 backdrop-blur-sm space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">
              {thread.subject ?? t("inbox.noSubject")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {thread.fromName
                ? <><span className="text-white/80">{thread.fromName}</span> &lt;{thread.fromEmail}&gt;</>
                : thread.fromEmail}
              <span className="mx-1.5 text-white/20">·</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${STATUS_CLASSES[thread.status] ?? STATUS_CLASSES.resolved}`}>
                {thread.status}
              </span>
              {thread.caseTypeSlug && (
                <><span className="mx-1.5 text-white/20">·</span>{thread.caseTypeSlug}</>
              )}
            </p>
          </div>
          <Link
            href={`/app/thread/${thread.id}`}
            className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white transition-colors border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1.5"
          >
            {t("inbox.thread.status.open")}
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
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* Conversation */}
        {messages.map(m => (
          <div
            key={m.id}
            className={`rounded-2xl border p-4 ${
              m.role === "customer"
                ? "border-white/8 bg-[#050B1C]/60"
                : m.role === "assistant"
                  ? "border-primary/20 bg-primary/[0.04] ml-8"
                  : "border-cyan-500/20 bg-cyan-500/[0.04] ml-8"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {m.role === "customer" ? t("inbox.thread.roles.customer") : m.role === "assistant" ? t("inbox.thread.roles.ai") : t("inbox.thread.roles.agent")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(m.sentAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE")}
              </span>
            </div>
            <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{m.bodyText}</p>
          </div>
        ))}

        {/* Internal notes */}
        <InternalNotes threadId={thread.id} initial={notes} />

        {/* Draft action area */}
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{t("inbox.thread.draft")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {canGenerate ? t("inbox.thread.status.canGenerate") : t("inbox.thread.status.limitReached")}
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("inbox.thread.status.drafts")} ({drafts.length})
            </p>
            {drafts.map(d => (
              <div key={d.id} className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ActionBadge action={d.action} t={t} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{d.status}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(d.generatedAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE")}
                  </span>
                </div>

                {d.bodyText && (
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{d.bodyText}</p>
                )}

                {d.action === "summarize" && d.metadata && (
                  <div className="border-t border-white/5 pt-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("inbox.thread.status.summary")}</p>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {String((d.metadata as Record<string, unknown>).summary ?? "")}
                    </p>
                  </div>
                )}

                {d.action === "escalate" && (
                  <p className="text-xs text-red-400">
                    {String(d.metadata?.reason ?? t("inbox.thread.actions.escalate"))}
                  </p>
                )}

                <DraftActions
                  draftId={d.id}
                  action={d.action}
                  status={d.status}
                  initialBody={d.bodyText}
                  templateVars={templateVars}
                  onDone={() => { load(); router.refresh(); }}
                />

                <p className="text-[10px] text-muted-foreground border-t border-white/5 pt-2">
                  {d.aiModel}
                  {d.status === "sent" && d.sentAt && <> · {t("inbox.thread.status.sent", { time: new Date(d.sentAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE") })}</>}
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
