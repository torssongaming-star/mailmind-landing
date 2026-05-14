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
  const [open, setOpen]               = useState(false);
  const [templates, setTemplates]     = useState<Template[] | null>(null);
  const [loading, setLoading]         = useState(false);
  const [insertingId, setInsertingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates !== null || loading) return;
    setLoading(true);
    fetch("/api/app/templates")
      .then(r => r.ok ? r.json() : null)
      .then(data => setTemplates(data?.templates ?? []))
      .finally(() => setLoading(false));
  }, [open, templates, loading]);

  const handleInsert = async (tpl: Template) => {
    setInsertingId(tpl.id);
    onInsert(interpolateTemplate(tpl.bodyText, templateVars));
    setOpen(false);
    // Fire-and-forget: increment use_count on the server
    fetch(`/api/app/templates/${tpl.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use" }),
    }).catch(() => {});
    setInsertingId(null);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-white inline-flex items-center gap-1.5"
      >
        <span>＋</span> Infoga mall
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-2 max-h-48 overflow-y-auto">
      <div className="flex items-center justify-between px-1 py-1 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Mallar</span>
        <button
          onClick={() => setOpen(false)}
          className="text-[11px] text-muted-foreground hover:text-white"
        >
          Stäng
        </button>
      </div>
      {loading && <p className="text-xs text-muted-foreground italic px-2 py-1">Laddar…</p>}
      {!loading && templates && templates.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-2 py-1">
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
                disabled={!!insertingId}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                <p className="text-xs text-white">{t.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t.bodyText}</p>
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

  const call = async (payload: object) => {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
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
              await call({ action: "edit", bodyText: body });
              setEditing(false);
            }}
            disabled={pending || !body.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            {pending ? "Sparar…" : "Spara"}
          </button>
          <button
            onClick={async () => {
              await call({ action: "edit", bodyText: body });
              await call({ action: "send" });
            }}
            disabled={pending || !body.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-[#030614] hover:bg-cyan-300 transition-colors disabled:opacity-40"
          >
            Spara och skicka
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
