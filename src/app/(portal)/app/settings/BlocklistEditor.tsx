"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BlockEntry = {
  id: string;
  pattern: string;
  reason: string | null;
  createdAt: string | Date;
};

export function BlocklistEditor({ initial }: { initial: BlockEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState<BlockEntry[]>(initial);
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!pattern.trim()) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/app/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: pattern.trim(), reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte lägga till");
      setEntries(prev => [...prev, data.entry]);
      setPattern("");
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/app/blocklist/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ta bort");
      }
      setEntries(prev => prev.filter(e => e.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Add new entry */}
      <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-4 space-y-3">
        <p className="text-xs font-semibold text-white/70">Lägg till mönster</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Mönster (t.ex. @newsletters.com)
            </label>
            <input
              type="text"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="noreply@example.com eller @domain.com"
              className="bl-input"
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Anledning (valfritt)
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nyhetsbrev"
              className="bl-input"
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={pending || !pattern.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-[#030614] hover:bg-cyan-300 transition-colors disabled:opacity-40"
          >
            {pending ? "Lägger till…" : "Lägg till"}
          </button>
        </div>
      </div>

      {/* Existing entries */}
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1 py-3">
          Ingen blocklista ännu.
        </p>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 overflow-hidden">
          <ul className="divide-y divide-white/5">
            {entries.map(e => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono truncate">{e.pattern}</p>
                  {e.reason && (
                    <p className="text-xs text-muted-foreground truncate">{e.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(e.id)}
                  disabled={deletingId === e.id}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 shrink-0"
                >
                  {deletingId === e.id ? "Tar bort…" : "Ta bort"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .bl-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.1);
          outline: none;
        }
        .bl-input:focus { border-color: rgba(99,102,241,0.5); }
      `}</style>
    </div>
  );
}
