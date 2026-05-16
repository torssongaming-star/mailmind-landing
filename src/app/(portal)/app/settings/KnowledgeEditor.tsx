"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KnowledgeSetupWizard } from "./KnowledgeSetupWizard";

type Entry = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  isActive: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  pricing:  "Priser",
  contact:  "Kontakt",
  hours:    "Öppettider",
  faq:      "Vanliga frågor",
  policy:   "Policy",
  other:    "Övrigt",
};

export function KnowledgeEditor({ initial }: { initial: Entry[] }) {
  const router = useRouter();
  const [entries, setEntries]     = useState<Entry[]>(initial);
  const [showWizard, setShowWizard] = useState(initial.length === 0);
  const [showForm, setShowForm]   = useState(false);
  const [newQ, setNewQ]           = useState("");
  const [newA, setNewA]           = useState("");
  const [newCat, setNewCat]       = useState("faq");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping]   = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  const addEntry = async () => {
    if (!newQ.trim() || !newA.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQ.trim(), answer: newA.trim(), category: newCat }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setEntries(prev => [...prev, data.entry]);
      setNewQ(""); setNewA(""); setNewCat("faq");
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (entry: Entry) => {
    const updated = { ...entry, isActive: !entry.isActive };
    setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
    await fetch(`/api/app/knowledge/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: updated.isActive }),
    });
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Ta bort detta svar?")) return;
    // Optimistic delete — reverse on server failure
    const previous = entries;
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch(`/api/app/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setEntries(previous);
        setError("Kunde inte ta bort svaret. Försök igen.");
        return;
      }
      router.refresh();
    } catch {
      setEntries(previous);
      setError("Nätverksfel. Försök igen.");
    }
  };

  const scrape = async () => {
    if (!scrapeUrl.trim() || scraping) return;
    setScraping(true);
    setScrapeMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/app/knowledge/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      if (data.inserted > 0) {
        setScrapeMsg(`✓ Lade till ${data.inserted} svar från hemsidan.`);
        router.refresh();
        // Reload entries from server via refresh — add locally too for immediacy
        setEntries(prev => [...prev, ...(data.entries ?? []).map((e: Entry & { id?: string }) => ({
          ...e,
          id: e.id ?? Math.random().toString(),
          isActive: true,
          category: e.category ?? "faq",
        }))]);
      } else {
        setScrapeMsg(data.message ?? "Hittade ingen tydlig info på sidan.");
      }
      setScrapeUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setScraping(false);
    }
  };

  const activeCount = entries.filter(e => e.isActive).length;

  return (
    <div className="space-y-4">
      {/* Guided setup wizard — shown when KB is empty or user wants to redo */}
      {showWizard ? (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <KnowledgeSetupWizard onComplete={() => { setShowWizard(false); router.refresh(); }} />
        </div>
      ) : entries.length === 0 && (
        <button
          onClick={() => setShowWizard(true)}
          className="w-full rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/5 px-4 py-4 text-sm text-indigo-300 hover:border-indigo-400/50 hover:text-indigo-200 transition-colors"
        >
          ✦ Kom igång med guidad kunskapsbas-setup
        </button>
      )}

      {!showWizard && entries.length > 0 && (
        <button
          onClick={() => setShowWizard(true)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Kör guidad setup igen
        </button>
      )}

      {/* Scrape from website */}
      <div className="rounded-xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-4 space-y-3">
        <p className="text-xs font-semibold text-white/80">Importera från hemsida</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={scrapeUrl}
            onChange={e => setScrapeUrl(e.target.value)}
            placeholder="https://dittforetag.se/priser"
            className="flex-1 bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
          />
          <button
            onClick={scrape}
            disabled={scraping || !scrapeUrl.trim()}
            className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors disabled:opacity-40 shrink-0"
          >
            {scraping ? "Läser…" : "Hämta"}
          </button>
        </div>
        {scrapeMsg && <p className="text-xs text-green-400">{scrapeMsg}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Entry list */}
      {entries.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 divide-y divide-white/5 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-2 bg-white/[0.02]">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex-1">
              {entries.length} svar · {activeCount} aktiva
            </span>
            <span className="text-[10px] text-muted-foreground">Aktiv</span>
          </div>
          {entries.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{entry.question}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.answer}</p>
                {entry.category && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-muted-foreground">
                    {CATEGORY_LABELS[entry.category] ?? entry.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <button
                  onClick={() => toggleActive(entry)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    entry.isActive ? "bg-primary" : "bg-white/15"
                  }`}
                  title={entry.isActive ? "Inaktivera" : "Aktivera"}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    entry.isActive ? "left-4.5 translate-x-0" : "left-0.5"
                  }`} />
                </button>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Ta bort
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new entry */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
        >
          + Lägg till svar manuellt
        </button>
      ) : (
        <div className="rounded-xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-4 space-y-3">
          <input
            type="text"
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            placeholder="Fråga, t.ex. Vad kostar parkering?"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
          />
          <textarea
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Svar, t.ex. Parkering kostar 500 kr/mån, kontakta receptionen."
            rows={3}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40 resize-none"
          />
          <select
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setNewQ(""); setNewA(""); setError(null); }}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={addEntry}
              disabled={saving || !newQ.trim() || !newA.trim()}
              className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {saving ? "Sparar…" : "Spara"}
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Aktiva svar injiceras i AI:ns systemprompt. AI:n kan svara direkt på frågor utan att behöva eskalera.
      </p>
    </div>
  );
}
