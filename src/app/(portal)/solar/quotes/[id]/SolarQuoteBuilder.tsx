"use client";

/**
 * SolarQuoteBuilder
 *
 * Client island for the solar quote detail page.
 * Manages the full quote-building workflow:
 *   1. Fill in system parameters (roof surfaces + scalars)
 *   2. POST /api/quoting/solar/calculate → ROI result card
 *   3. Optionally: POST /api/quoting/solar/draft → AI narrative
 *
 * State machine: idle → calculating → calculated | error
 * Never fetches KB directly — that runs server-side in the parent page.
 */

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { RoofSurfaceForm } from "@/components/solar/RoofSurfaceForm";
import { RoiResultCard } from "@/components/solar/RoiResultCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { RoofSurfaceInput } from "@/lib/solar/engine/types";
import type { SolarEngineResult } from "@/lib/solar/engine/types";
import type { Quote } from "@/lib/quoting-common/domain/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalculateState =
  | { phase: "idle" }
  | { phase: "calculating" }
  | { phase: "calculated"; result: SolarEngineResult; scenarioId: string }
  | { phase: "error"; message: string };

type DraftState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; narrativeText: string; riskFlags: string[] }
  | { phase: "error"; message: string };

// ── Constants (default scalars) ───────────────────────────────────────────────

const DEFAULTS = {
  systemCapacityKwp:        10,
  annualConsumptionKwh:     10000,
  electricityPriceSekPerKwh: 1.80,
  feedInTariffSekPerKwh:    0.65,
  systemCostSek:            120000,
  includeRot:               true,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SolarQuoteBuilder({
  quote,
  customerName,
}: {
  quote:        Quote;
  customerName: string;
}) {
  const [scalars, setScalars]   = useState(DEFAULTS);
  const [calcState, setCalc]    = useState<CalculateState>({ phase: "idle" });
  const [draftState, setDraft]  = useState<DraftState>({ phase: "idle" });
  const [scopeBrief, setScopeBrief] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ── Calculate ─────────────────────────────────────────────────────────────

  async function handleCalculate(surfaces: RoofSurfaceInput[]) {
    setCalc({ phase: "calculating" });
    setDraft({ phase: "idle" });

    try {
      const res = await fetch("/api/quoting/solar/calculate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          quoteId: quote.id,
          surfaces,
          ...scalars,
        }),
      });

      const json = await res.json() as { scenarioId?: string; result?: SolarEngineResult; error?: string };

      if (!res.ok || !json.result) {
        setCalc({ phase: "error", message: json.error ?? "Beräkning misslyckades." });
        return;
      }

      setCalc({
        phase:      "calculated",
        result:     json.result,
        scenarioId: json.scenarioId ?? "",
      });
    } catch {
      setCalc({ phase: "error", message: "Nätverksfel. Försök igen." });
    }
  }

  // ── AI draft ──────────────────────────────────────────────────────────────

  async function handleDraft() {
    if (!scopeBrief.trim()) return;
    setDraft({ phase: "loading" });

    try {
      const res = await fetch("/api/quoting/solar/draft", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          quoteId:      quote.id,
          customerName: customerName || "Kund",
          scopeBrief:   scopeBrief.trim(),
        }),
      });

      const json = await res.json() as {
        draft?: { narrativeText: string; riskFlags: string[] };
        error?: string;
      };

      if (!res.ok || !json.draft) {
        setDraft({ phase: "error", message: json.error ?? "Utkast misslyckades." });
        return;
      }

      setDraft({
        phase:         "done",
        narrativeText: json.draft.narrativeText,
        riskFlags:     json.draft.riskFlags,
      });
      setSaveState("idle");
    } catch {
      setDraft({ phase: "error", message: "Nätverksfel. Försök igen." });
    }
  }

  // ── Persist narrative to the quote (for the printable document) ──────────────

  async function handleSaveNarrative() {
    if (draftState.phase !== "done") return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/quoting/quotes/${quote.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          meta: { ...(quote.meta ?? {}), narrativeText: draftState.narrativeText },
        }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── System scalars ── */}
      <Card variant="default" padding="md">
        <CardHeader
          title="Systemparametrar"
          description="Ange kapacitet, kostnad och förbrukningsprofil."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ScalarInput
            label="Systemstorlek (kWp)"
            value={scalars.systemCapacityKwp}
            min={1}
            step={0.5}
            onChange={(v) => setScalars((p) => ({ ...p, systemCapacityKwp: v }))}
          />
          <ScalarInput
            label="Årsförbrukning (kWh)"
            value={scalars.annualConsumptionKwh}
            min={1000}
            step={500}
            onChange={(v) => setScalars((p) => ({ ...p, annualConsumptionKwh: v }))}
          />
          <ScalarInput
            label="Elpris (kr/kWh)"
            value={scalars.electricityPriceSekPerKwh}
            min={0.5}
            step={0.05}
            decimals={2}
            onChange={(v) => setScalars((p) => ({ ...p, electricityPriceSekPerKwh: v }))}
          />
          <ScalarInput
            label="Inmatningstariff (kr/kWh)"
            value={scalars.feedInTariffSekPerKwh}
            min={0}
            step={0.05}
            decimals={2}
            onChange={(v) => setScalars((p) => ({ ...p, feedInTariffSekPerKwh: v }))}
          />
          <ScalarInput
            label="Systemkostnad (kr)"
            value={scalars.systemCostSek}
            min={10000}
            step={5000}
            onChange={(v) => setScalars((p) => ({ ...p, systemCostSek: v }))}
          />
          <div className="flex items-center gap-2 pt-5">
            <input
              id="includeRot"
              type="checkbox"
              checked={scalars.includeRot}
              onChange={(e) => setScalars((p) => ({ ...p, includeRot: e.target.checked }))}
              className="accent-primary w-4 h-4"
            />
            <label htmlFor="includeRot" className="text-xs text-white/60">
              Inkludera ROT-avdrag
            </label>
          </div>
        </div>
      </Card>

      {/* ── Roof surfaces ── */}
      <Card variant="default" padding="md">
        <CardHeader
          title="Takytor"
          description="Lägg till en eller flera takytor. Beräkningarna väger samman alla ytor."
        />
        <RoofSurfaceForm
          onSubmit={handleCalculate}
          loading={calcState.phase === "calculating"}
        />
      </Card>

      {/* ── Calculation result ── */}
      {calcState.phase === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {calcState.message}
        </div>
      )}

      {calcState.phase === "calculated" && (
        <div className="space-y-4">
          <RoiResultCard result={calcState.result} />
          <p className="text-[11px] text-white/30 text-right font-mono">
            Scenario: {calcState.scenarioId}
          </p>
        </div>
      )}

      {/* ── AI draft section ── */}
      <Card variant="default" padding="md">
        <CardHeader
          title="AI-offerttext"
          description="Beskriv projektet i fritext — AI:n skapar ett kundutkast med korrekt terminologi."
        />
        <div className="space-y-3">
          <textarea
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors resize-none"
            rows={4}
            placeholder="t.ex. Villa i Täby, 10 kWp södertak, förbrukning ca 10 000 kWh/år, 2 vuxna"
            value={scopeBrief}
            onChange={(e) => setScopeBrief(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDraft}
              disabled={draftState.phase === "loading" || !scopeBrief.trim()}
            >
              {draftState.phase === "loading" ? "Genererar…" : "Generera AI-utkast"}
            </Button>
          </div>
        </div>

        {/* Draft result */}
        {draftState.phase === "done" && (
          <div className="mt-4 space-y-3">
            {draftState.riskFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draftState.riskFlags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="text-xs font-semibold text-white/50 mb-2">Utkast</p>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {draftState.narrativeText}
              </p>
            </div>

            {/* Save + open document */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/40">
                {saveState === "saved"
                  ? "Sparat på offerten."
                  : saveState === "error"
                  ? "Kunde inte spara — försök igen."
                  : "Spara utkastet för att inkludera det i offertdokumentet."}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveNarrative}
                  disabled={saveState === "saving"}
                >
                  {saveState === "saving" ? "Sparar…" : saveState === "saved" ? "Sparat ✓" : "Spara utkast"}
                </Button>
                <Link
                  href={`/solar/quotes/${quote.id}/document`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#050B1C]/50 px-4 py-1.5 text-sm font-medium text-foreground hover:bg-white/5 hover:border-primary/30 transition-all"
                >
                  <FileText size={14} />
                  Offertdokument
                </Link>
              </div>
            </div>
          </div>
        )}

        {draftState.phase === "error" && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {draftState.message}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── ScalarInput helper ────────────────────────────────────────────────────────

function ScalarInput({
  label,
  value,
  min,
  step,
  decimals = 0,
  onChange,
}: {
  label:     string;
  value:     number;
  min:       number;
  step:      number;
  decimals?: number;
  onChange:  (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-white/50 mb-1">{label}</label>
      <input
        type="number"
        min={min}
        step={step}
        value={decimals > 0 ? value : value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors"
      />
    </div>
  );
}
