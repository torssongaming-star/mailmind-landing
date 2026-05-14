"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Note = {
  id:          string;
  bodyText:    string;
  authorEmail: string | null;
  createdAt:   Date;
};

export function InternalNotes({
  threadId,
  initial,
}: {
  threadId: string;
  initial: Note[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initial);
  const [text, setText]   = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/threads/${threadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte spara anteckning");
      setNotes(prev => [...prev, { ...data.note, createdAt: new Date(data.note.createdAt) }]);
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ta bort anteckningen?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/app/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ta bort anteckning");
      }
      setNotes(prev => prev.filter(n => n.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    }
  };

  return (
    <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.025] p-5 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest">
          Interna anteckningar
        </h2>
        <span className="text-[10px] text-muted-foreground">Syns inte för kunden</span>
      </header>

      {/* Existing notes */}
      {notes.length > 0 && (
        <ul className="space-y-2.5">
          {notes.map(n => (
            <li key={n.id} className="rounded-xl border border-amber-500/10 bg-black/20 p-3 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{n.bodyText}</p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="opacity-0 group-hover:opacity-100 text-[11px] text-red-400/70 hover:text-red-300 transition-opacity"
                  aria-label="Ta bort anteckning"
                >
                  Ta bort
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {n.authorEmail ?? "Unknown author"}
                {" · "}
                {new Date(n.createdAt).toLocaleString("sv-SE")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* New-note form */}
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Lägg till en intern anteckning (syns bara för ditt team)…"
          rows={2}
          className="w-full bg-black/30 text-white text-sm rounded-lg px-3 py-2 border border-amber-500/15 focus:border-amber-500/40 focus:outline-none placeholder:text-muted-foreground/40 resize-none"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={posting || !text.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
          >
            {posting ? "Sparar…" : "Posta anteckning"}
          </button>
        </div>
      </div>
    </section>
  );
}
