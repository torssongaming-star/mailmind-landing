"use client";

/**
 * ConstructionQuoteBuilder — client island for the construction quote detail.
 *
 * Mirrors SolarQuoteBuilder: estimate inputs → calculate → result card; AI
 * narrative draft → save to quote.meta → document link; send to customer.
 * State machine: idle → calculating → calculated | error.
 */

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EstimateResultCard } from "@/components/construction/EstimateResultCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ConstructionEstimateResult } from "@/lib/construction/engine/types";
import type { Quote } from "@/lib/quoting-common/domain/types";

type CalcState =
  | { phase: "idle" }
  | { phase: "calculating" }
  | { phase: "calculated"; result: ConstructionEstimateResult }
  | { phase: "error"; message: string };

type DraftState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; narrativeText: string; riskFlags: string[] }
  | { phase: "error"; message: string };

const DEFAULTS = {
  projectType:          "Badrumsrenovering",
  areaM2:               10,
  materialCostSekPerM2: 3000,
  labourHours:          80,
  labourRateSekPerHour: 650,
  includeRot:           true,
};

const INPUT_CLASS =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors";
const LABEL_CLASS = "block text-[11px] font-medium text-white/50 mb-1";

export function ConstructionQuoteBuilder({
  quote,
  customerName,
  customerEmail,
  canManage,
}: {
  quote:         Quote;
  customerName:  string;
  customerEmail: string | null;
  canManage:     boolean;
}) {
  const [inputs, setInputs]   = useState(DEFAULTS);
  const [calc, setCalc]       = useState<CalcState>({ phase: "idle" });
  const [draft, setDraft]     = useState<DraftState>({ phase: "idle" });
  const [scopeBrief, setBrief] = useState("");
  const [saveState, setSave]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sendState, setSend]  = useState<
    { phase: "idle" | "sending" | "sent" } | { phase: "error"; message: string }
  >({ phase: quote.status === "sent" || quote.status === "viewed" ? "sent" : "idle" });

  async function handleCalculate() {
    setCalc({ phase: "calculating" });
    setDraft({ phase: "idle" });
    try {
      const res = await fetch("/api/quoting/construction/calculate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ quoteId: quote.id, ...inputs }),
      });
      const json = await res.json() as { result?: ConstructionEstimateResult; error?: string };
      if (!res.ok || !json.result) {
        setCalc({ phase: "error", message: json.error ?? "Beräkning misslyckades." });
        return;
      }
      setCalc({ phase: "calculated", result: json.result });
    } catch {
      setCalc({ phase: "error", message: "Nätverksfel. Försök igen." });
    }
  }

  async function handleDraft() {
    if (!scopeBrief.trim()) return;
    setDraft({ phase: "loading" });
    try {
      const res = await fetch("/api/quoting/construction/draft", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ quoteId: quote.id, customerName: customerName || "Kund", scopeBrief: scopeBrief.trim() }),
      });
      const json = await res.json() as { draft?: { narrativeText: string; riskFlags: string[] }; error?: string };
      if (!res.ok || !json.draft) {
        setDraft({ phase: "error", message: json.error ?? "Utkast misslyckades." });
        return;
      }
      setDraft({ phase: "done", narrativeText: json.draft.narrativeText, riskFlags: json.draft.riskFlags });
      setSave("idle");
    } catch {
      setDraft({ phase: "error", message: "Nätverksfel. Försök igen." });
    }
  }

  async function handleSaveNarrative() {
    if (draft.phase !== "done") return;
    setSave("saving");
    try {
      const res = await fetch(`/api/quoting/quotes/${quote.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ meta: { ...(quote.meta ?? {}), narrativeText: draft.narrativeText } }),
      });
      setSave(res.ok ? "saved" : "error");
    } catch {
      setSave("error");
    }
  }

  async function handleSend() {
    setSend({ phase: "sending" });
    try {
      const res = await fetch(`/api/quoting/construction/quotes/${quote.id}/send`, { method: "POST" });
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; blockedReasons?: string[] };
      if (!res.ok || !json.ok) {
        const extra = json.blockedReasons?.length ? ` (${json.blockedReasons.join(", ")})` : "";
        setSend({ phase: "error", message: (json.error ?? "Kunde inte skicka.") + extra });
        return;
      }
      setSend({ phase: "sent" });
    } catch {
      setSend({ phase: "error", message: "Nätverksfel. Försök igen." });
    }
  }

  return (
    <div className="space-y-6">
      {/* Estimate inputs */}
      <Card variant="default" padding="md">
        <CardHeader title="Projektparametrar" description="Ange omfattning, material och arbetstid." />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3">
            <label className={LABEL_CLASS}>Projekttyp</label>
            <input className={INPUT_CLASS} value={inputs.projectType} onChange={(e) => setInputs((p) => ({ ...p, projectType: e.target.value }))} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Yta (m²)</label>
            <input type="number" min={1} step={0.5} className={INPUT_CLASS} value={inputs.areaM2} onChange={(e) => setInputs((p) => ({ ...p, areaM2: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Material (kr/m²)</label>
            <input type="number" min={0} step={100} className={INPUT_CLASS} value={inputs.materialCostSekPerM2} onChange={(e) => setInputs((p) => ({ ...p, materialCostSekPerM2: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Arbetstimmar</label>
            <input type="number" min={0} step={1} className={INPUT_CLASS} value={inputs.labourHours} onChange={(e) => setInputs((p) => ({ ...p, labourHours: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Timpris (kr)</label>
            <input type="number" min={0} step={50} className={INPUT_CLASS} value={inputs.labourRateSekPerHour} onChange={(e) => setInputs((p) => ({ ...p, labourRateSekPerHour: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input id="includeRot" type="checkbox" checked={inputs.includeRot} onChange={(e) => setInputs((p) => ({ ...p, includeRot: e.target.checked }))} className="accent-primary w-4 h-4" />
            <label htmlFor="includeRot" className="text-xs text-white/60">Inkludera ROT</label>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={handleCalculate} disabled={calc.phase === "calculating"}>
            {calc.phase === "calculating" ? "Beräknar…" : "Kör kalkyl"}
          </Button>
        </div>
      </Card>

      {calc.phase === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{calc.message}</div>
      )}
      {calc.phase === "calculated" && <EstimateResultCard result={calc.result} />}

      {/* AI draft */}
      <Card variant="default" padding="md">
        <CardHeader title="AI-offerttext" description="Beskriv projektet i fritext — AI:n skapar ett kundutkast." />
        <div className="space-y-3">
          <textarea
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors resize-none"
            rows={4}
            placeholder="t.ex. Helrenovering av badrum 10 m², tätskikt + kakel, ca 80 timmar"
            value={scopeBrief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleDraft} disabled={draft.phase === "loading" || !scopeBrief.trim()}>
              {draft.phase === "loading" ? "Genererar…" : "Generera AI-utkast"}
            </Button>
          </div>
        </div>

        {draft.phase === "done" && (
          <div className="mt-4 space-y-3">
            {draft.riskFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.riskFlags.map((flag) => (
                  <span key={flag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400">{flag}</span>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="text-xs font-semibold text-white/50 mb-2">Utkast</p>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{draft.narrativeText}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/40">
                {saveState === "saved" ? "Sparat på offerten." : saveState === "error" ? "Kunde inte spara." : "Spara utkastet för offertdokumentet."}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={handleSaveNarrative} disabled={saveState === "saving"}>
                  {saveState === "saving" ? "Sparar…" : saveState === "saved" ? "Sparat ✓" : "Spara utkast"}
                </Button>
                <Link href={`/construction/quotes/${quote.id}/document`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#050B1C]/50 px-4 py-1.5 text-sm font-medium text-foreground hover:bg-white/5 hover:border-primary/30 transition-all">
                  <FileText size={14} />
                  Offertdokument
                </Link>
              </div>
            </div>
          </div>
        )}
        {draft.phase === "error" && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{draft.message}</div>
        )}
      </Card>

      {/* Send */}
      {canManage && (
        <Card variant="default" padding="md">
          <CardHeader title="Skicka till kund" description="Skickar offerten via e-post. Egress-grinden körs innan utskick." />
          {sendState.phase === "sent" ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
              Offerten är skickad{customerEmail ? ` till ${customerEmail}` : ""}.
            </div>
          ) : (
            <div className="space-y-3">
              {!customerEmail && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-400/90">
                  Kunden saknar e-postadress. Lägg till en e-post på kunden innan du skickar.
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/40">{customerEmail ? `Mottagare: ${customerEmail}` : "Ingen mottagare"}</span>
                <Button size="sm" onClick={handleSend} disabled={!customerEmail || sendState.phase === "sending"}>
                  {sendState.phase === "sending" ? "Skickar…" : "Skicka offert"}
                </Button>
              </div>
              {sendState.phase === "error" && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{sendState.message}</div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
