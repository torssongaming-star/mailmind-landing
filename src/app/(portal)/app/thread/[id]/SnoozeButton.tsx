"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { label: "1 timme",     hours: 1 },
  { label: "3 timmar",    hours: 3 },
  { label: "I morgon",    hours: 24 },
  { label: "3 dagar",     hours: 72 },
  { label: "1 vecka",     hours: 168 },
];

export function SnoozeButton({
  threadId,
  snoozedUntil,
}: {
  threadId: string;
  snoozedUntil: Date | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSnoozed = snoozedUntil != null && new Date(snoozedUntil) > new Date();

  const snooze = async (until: Date | null) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/threads/${threadId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until: until ? until.toISOString() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  const snoozeFor = (hours: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    // Round to top of next hour for cleanliness
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    snooze(d);
  };

  if (isSnoozed) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-400 inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Snoozad till {new Date(snoozedUntil!).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
        </span>
        <button
          onClick={() => snooze(null)}
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-white underline underline-offset-2 transition-colors disabled:opacity-40"
        >
          {pending ? "…" : "Avsnooze"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        Snooze
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-20 rounded-xl border border-white/10 bg-[#030614]/95 backdrop-blur-md shadow-2xl p-2 min-w-[160px]">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 mb-1">
            Dölj tråden tills…
          </p>
          {PRESETS.map(p => (
            <button
              key={p.hours}
              onClick={() => snoozeFor(p.hours)}
              disabled={pending}
              className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-white hover:bg-white/8 transition-colors disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
          {error && (
            <p className="text-[10px] text-red-400 px-2 pt-1">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
