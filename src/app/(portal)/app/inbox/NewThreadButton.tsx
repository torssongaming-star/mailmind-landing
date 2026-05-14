"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewThreadButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fromEmail, setFromEmail] = useState("kund@exempel.se");
  const [fromName, setFromName]   = useState("Anna Andersson");
  const [subject, setSubject]     = useState("Offertförfrågan altanbygge");
  const [body, setBody]           = useState("Hej!\n\nJag skulle vilja ha en offert på ett altanbygge i Stockholm.\n\nMvh Anna");

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/app/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail, fromName, subject, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Kunde inte skapa tråd");
      }
      const { thread } = await res.json();
      setOpen(false);
      router.push(`/app/thread/${thread.id}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors whitespace-nowrap"
      >
        {compact ? "Ny" : "Ny testtråd"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#050B1C] p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <header>
              <h2 className="text-lg font-bold text-white">Ny testtråd</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Simulerar ett inkommande mejl så du kan prova AI-utkast-flödet.
              </p>
            </header>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Avsändare (e-post)" value={fromEmail} onChange={setFromEmail} type="email" />
              <Field label="Avsändare (namn)"   value={fromName}  onChange={setFromName} />
            </div>
            <Field label="Ämne" value={subject} onChange={setSubject} />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meddelande</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none resize-none"
              />
            </div>

            {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !fromEmail || !subject || !body}
                className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Skapar…" : "Skapa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label, value, onChange, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none"
      />
    </div>
  );
}
