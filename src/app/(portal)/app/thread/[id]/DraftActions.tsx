"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { interpolateTemplate } from "@/lib/utils/templateVars";

type DraftAction = "ask" | "summarize" | "escalate";
type DraftStatus = "pending" | "approved" | "edited" | "sent" | "rejected";

type Template = { id: string; title: string; slug: string | null; bodyText: string };

/**
 * Template-picker dropdown shown above the edit textarea.
 * Lazily fetches templates the first time it's expanded — no network cost
 * if the user never opens it.
 */
function TemplatePicker({ onInsert, templateVars }: { onInsert: (text: string) => void; templateVars: Record<string, string> }) {
  const [open, setOpen]           = useState(false);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!open || templates !== null || loading) return;
    setLoading(true);
    fetch("/api/app/templates")
      .then(r => r.ok ? r.json() : null)
      .then(data => setTemplates(data?.templates ?? []))
      .finally(() => setLoading(false));
  }, [open, templates, loading]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleInsert = (tpl: Template) => {
    onInsert(interpolateTemplate(tpl.bodyText, templateVars));
    setOpen(false);
    // Fire-and-forget: increment use_count on the server
    fetch(`/api/app/templates/${tpl.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use" }),
    }).catch(() => {});
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:text-white"
      >
        <span className="text-[15px] leading-none">＋</span> Infoga mall
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[hsl(var(--surface-deep))]/95 backdrop-blur-md p-2 max-h-56 overflow-y-auto shadow-lg">
      <div className="flex items-center justify-between px-1 py-1 mb-1">
        <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Mallar</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Stäng mallar"
          className="text-[11px] text-white/40 hover:text-white transition-colors"
        >
          Stäng
        </button>
      </div>
      {loading && (
        <div className="px-2 py-3 space-y-2">
          <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
          <div className="h-2.5 w-full rounded bg-white/[0.03] animate-pulse" />
        </div>
      )}
      {!loading && templates && templates.length === 0 && (
        <p className="text-xs text-white/45 italic px-2 py-2">
          Inga mallar ännu.{" "}
          <a href="/app/settings" className="text-primary hover:underline">Skapa en i inställningar →</a>
        </p>
      )}
      {!loading && templates && templates.length > 0 && (
        <ul className="space-y-0.5">
          {templates.map(t => (
            <li key={t.id}>
              <button
                onClick={() => handleInsert(t)}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:bg-white/[0.06]"
              >
                <p className="text-xs text-white">{t.title}</p>
                <p className="text-[10px] text-white/40 truncate">{t.bodyText}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DraftActions({
  draftId,
  action,
  status,
  initialBody,
  templateVars = {},
  onDone,
}: {
  draftId: string;
  action: DraftAction;
  status: DraftStatus;
  initialBody: string | null;
  templateVars?: Record<string, string>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sent/rejected drafts are frozen
  if (status === "sent" || status === "rejected") {
    return null;
  }

  /**
   * Returns true on success, false on failure. Callers can chain operations
   * conditionally — e.g. don't run "send" if "edit" failed.
   */
  const call = async (payload: object): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Åtgärden misslyckades");
      router.refresh();
      onDone?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
      return false;
    } finally {
      setPending(false);
    }
  };

  if (editing && action !== "escalate") {
    return (
      <div className="space-y-2 border-t border-white/5 pt-3">
        <TemplatePicker templateVars={templateVars} onInsert={tpl => setBody(prev => prev.trim() ? prev + "\n\n" + tpl : tpl)} />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          className="w-full bg-black/40 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none resize-none"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setEditing(false); setBody(initialBody ?? ""); }}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={async () => {
              const ok = await call({ action: "edit", bodyText: body });
              if (ok) setEditing(false);
            }}
            disabled={pending || !body.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            {pending ? "Sparar…" : "Spara"}
          </button>
          <button
            onClick={async () => {
              // Only proceed with send if edit succeeded — prevents
              // inconsistent state where draft is sent without the edits.
              const editOk = await call({ action: "edit", bodyText: body });
              if (editOk) {
                await call({ action: "send" });
              }
            }}
            disabled={pending || !body.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-[#030614] hover:bg-cyan-300 transition-colors disabled:opacity-40"
          >
            {pending ? "Skickar…" : "Spara och skicka"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-t border-white/5 pt-3">
      {action !== "escalate" && (
        <button
          onClick={() => setEditing(true)}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white border border-white/10 hover:border-white/20 transition-colors"
        >
          Redigera
        </button>
      )}
      <button
        onClick={() => call({ action: "reject" })}
        disabled={pending}
        className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-colors"
      >
        Avvisa
      </button>
      <div className="flex-1" />
      {error && <p className="text-xs text-red-400 mr-2">{error}</p>}
      <button
        onClick={() => call({ action: "send" })}
        disabled={pending || (action !== "escalate" && !initialBody?.trim())}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-[#030614] hover:bg-cyan-300 transition-colors disabled:opacity-40"
      >
        {pending
          ? "Skickar…"
          : action === "escalate"
            ? "Eskalera"
            : action === "summarize"
              ? "Skicka bekräftelse"
              : "Skicka svar"}
      </button>
    </div>
  );
}
