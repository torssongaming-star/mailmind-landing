"use client";

/**
 * RoiResultCard
 *
 * Displays the Solar ROI engine result in a customer-friendly card layout.
 * Shows the key financial KPIs + a simple cumulative savings sparkline table.
 *
 * Pure presentational component — receives SolarEngineResult as prop.
 * No fetching, no mutations.
 */

import type { SolarEngineResult } from "@/lib/solar/engine/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtSek(n: number): string {
  return `${fmt(Math.round(n))} kr`;
}

function fmtKwh(n: number): string {
  return `${fmt(Math.round(n))} kWh`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiRow({
  label,
  value,
  sub,
  highlight,
}: {
  label:     string;
  value:     string;
  sub?:      string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/55 shrink-0">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums text-right", highlight ? "text-emerald-400" : "text-white")}>
        {value}
        {sub && <span className="text-[11px] text-white/40 font-normal ml-1.5">{sub}</span>}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RoiResultCard({ result }: { result: SolarEngineResult }) {
  const irrPct = result.irr !== null ? `${(result.irr * 100).toFixed(1)} %` : "—";
  const scPct  = `${(result.selfConsumptionRate * 100).toFixed(0)} %`;

  // Show max 10 years in the table
  const tableRows = result.yearlyData.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <Card variant="elevated" padding="md">
        <CardHeader
          title="ROI-sammanfattning"
          description={`Motor: ${result.engineVersion}`}
        />

        <div className="divide-y divide-white/[0.05]">
          <KpiRow
            label="Årsproduktion (år 1)"
            value={fmtKwh(result.annualProductionKwhY1)}
          />
          <KpiRow
            label="Egenanvändning"
            value={fmtKwh(result.selfConsumptionKwhY1)}
            sub={scPct}
          />
          <KpiRow
            label="Överskott till nät"
            value={fmtKwh(result.feedInKwhY1)}
          />
          <KpiRow
            label="Besparing (år 1)"
            value={fmtSek(result.annualSavingsSekY1)}
            highlight
          />
          <KpiRow
            label="ROT-avdrag"
            value={fmtSek(result.rotDeductionSek)}
          />
          <KpiRow
            label="Nettokostnad"
            value={fmtSek(result.netSystemCostSek)}
          />
          <KpiRow
            label="Återbetalningstid"
            value={`${fmt(result.paybackYears, 1)} år`}
            highlight
          />
          <KpiRow
            label="NPV (25 år)"
            value={fmtSek(result.npv)}
            highlight={result.npv > 0}
          />
          <KpiRow
            label="IRR"
            value={irrPct}
          />
          <KpiRow
            label="CO₂-besparing"
            value={`${fmt(result.co2AvoidedKgPerYearY1)} kg/år`}
          />
        </div>
      </Card>

      {/* Yearly data table (condensed) */}
      <Card variant="default" padding="none">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">Kumulativ besparing</p>
          <p className="text-xs text-white/45 mt-0.5">Första 10 åren</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-semibold text-white/35 uppercase tracking-wider px-5 py-2.5">År</th>
                <th className="text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider px-4 py-2.5">Produktion</th>
                <th className="text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider px-4 py-2.5">Besparing</th>
                <th className="text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider px-4 py-2.5">Kumulativt</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr
                  key={row.year}
                  className={cn(
                    "border-b border-white/[0.04] last:border-0",
                    i % 2 === 0 ? "bg-white/[0.01]" : "",
                  )}
                >
                  <td className="px-5 py-2 text-white/60">{row.year}</td>
                  <td className="px-4 py-2 text-right text-white/60 tabular-nums">
                    {fmt(Math.round(row.productionKwh))}
                  </td>
                  <td className="px-4 py-2 text-right text-white/80 tabular-nums">
                    {fmtSek(row.annualSavingsSek)}
                  </td>
                  <td className={cn(
                    "px-4 py-2 text-right font-medium tabular-nums",
                    row.cumulativeSavingsSek > 0 ? "text-emerald-400" : "text-white/50",
                  )}>
                    {fmtSek(row.cumulativeSavingsSek)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
