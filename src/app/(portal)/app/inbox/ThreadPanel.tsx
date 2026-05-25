"use client";

/**
 * Right-panel thread viewer for the split-pane inbox.
 * Fetches thread + messages + drafts + notes client-side when threadId changes.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { sanitizeEmailHtml } from "@/lib/utils/sanitize-email-html";
import { DraftSources } from "@/components/app/DraftSources";
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
  triageFailed: boolean;
};

type Message = {
  id: string;
  role: "customer" | "assistant" | "agent";
  bodyText: string | null;
  bodyHtml: string | null;
  sentAt: string | Date;
};

type DraftStatus = "pending" | "approved" | "edited" | "sending" | "sent" | "rejected";

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
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [retrying,   setRetrying]   = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

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
            <MessageBody bodyHtml={m.bodyHtml} bodyText={m.bodyText} />
          </div>
        ))}

        {/* Internal notes */}
        <InternalNotes threadId={thread.id} initial={notes} />

        {/* Bulk-classified override banner */}
        {thread.caseTypeSlug === "bulk" && (() => {
          const senderDomain = thread.fromEmail.includes("@")
            ? thread.fromEmail.slice(thread.fromEmail.lastIndexOf("@"))
            : null;

          const runRetry = async (trustSender: boolean) => {
            setRetrying(true);
            setRetryError(null);
            try {
              const res = await fetch(`/api/app/threads/${thread.id}/retry-triage`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ bypassBulk: true, trustSender }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({})) as { reason?: string };
                setRetryError(data.reason ?? "Misslyckades, försök igen.");
              } else {
                await load();
                // Thread just moved out of the Reklam tab — navigate the user
                // to a view where they'll actually see it (default inbox),
                // and keep the same thread open in the panel.
                router.push(`/app/inbox?thread=${thread.id}`);
                router.refresh();
              }
            } catch {
              setRetryError("Nätverksfel, försök igen.");
            } finally {
              setRetrying(false);
            }
          };

          return (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] px-5 py-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Klassad som reklam</p>
                  <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                    Mailmind bedömde att detta är ett massutskick eller nyhetsbrev.
                    Om det är fel kan du återställa tråden nedan.
                  </p>
                  {retryError && (
                    <p className="text-xs text-red-400 mt-1">{retryError}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-7">
                <button
                  onClick={() => runRetry(false)}
                  disabled={retrying || !canGenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-medium text-amber-200 hover:bg-amber-500/25 hover:text-white transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={12} className={retrying ? "animate-spin" : ""} />
                  Detta är inte reklam
                </button>
                {senderDomain && (
                  <button
                    onClick={() => runRetry(true)}
                    disabled={retrying || !canGenerate}
                    title={`Alla framtida mejl från ${senderDomain} passerar reklam-filtret`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
                  >
                    Lita på {senderDomain} framöver
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Triage failed banner */}
        {thread.triageFailed && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.05] px-5 py-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">AI-triagering misslyckades</p>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                AI:n kunde inte generera ett utkast — troligen ett tillfälligt avbrott hos Anthropic. Inget mejl har skickats.
              </p>
              {retryError && (
                <p className="text-xs text-red-400 mt-1">{retryError}</p>
              )}
            </div>
            <button
              onClick={async () => {
                setRetrying(true);
                setRetryError(null);
                try {
                  const res = await fetch(`/api/app/threads/${thread.id}/retry-triage`, { method: "POST" });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({})) as { reason?: string };
                    setRetryError(data.reason === "ai_transient_error"
                      ? "AI:n är fortfarande otillgänglig, försök igen om en stund."
                      : "Misslyckades, försök igen.");
                  } else {
                    await load();
                    router.refresh();
                  }
                } catch {
                  setRetryError("Nätverksfel, försök igen.");
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying || !canGenerate}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={12} className={retrying ? "animate-spin" : ""} />
              {retrying ? "Försöker…" : "Triage igen"}
            </button>
          </div>
        )}

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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
                {t("inbox.thread.statusLabels.drafts")} <span className="tabular-nums text-white/30">({drafts.length})</span>
              </p>
              <p className="text-[10px] text-white/35 flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                AI-genererat — granska före utskick
              </p>
            </div>
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

                {/* P3.6 — Källhänvisning: alltid synlig. När tomt → varnings-
                    ruta så användaren ser att AI:n inte hänvisade till KB. */}
                {(() => {
                  const meta = d.metadata as { sources?: Array<{ kb_entry_id: string; snippet: string }> } | null;
                  return <DraftSources sources={meta?.sources ?? []} />;
                })()}

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

function ActionBadge({ action, t }: { action: "ask" | "summarize" | "escalate"; t: (path: string) => string }) {
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

/**
 * Renders an incoming customer email body — prefers the HTML version so
 * signatures, line-wrapping and inline links display the way they do in
 * the customer's mail client. Falls back to plain text for messages
 * without an HTML part (rare — Gmail/Outlook always include both).
 *
 * HTML is sanitised in-browser via DOMPurify before insertion.
 */
function MessageBody({ bodyHtml, bodyText }: { bodyHtml: string | null; bodyText: string | null }) {
  const safeHtml = useMemo(
    () => (bodyHtml ? sanitizeEmailHtml(bodyHtml) : ""),
    [bodyHtml],
  );

  if (bodyHtml && safeHtml) {
    return (
      <div
        // Constrain email styling so a hostile sender can't blow up the layout:
        //   - max-w-none lets long quotes/images flow naturally inside the panel
        //   - all-revert resets inherited classes so <p>/<table>/<a> render
        //     with sensible defaults instead of the panel's text-white styles
        className="email-body text-sm text-white/90 leading-relaxed [&_a]:text-cyan-400 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_table]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-3 [&_blockquote]:text-white/55"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }
  return (
    <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{bodyText}</p>
  );
}
