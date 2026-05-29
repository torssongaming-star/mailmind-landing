"use client";

/**
 * EstimateResultCard — displays a ConstructionEstimateResult breakdown.
 * Pure presentational component.
 */

import type { ConstructionEstimateResult } from "@/lib/construction/engine/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

function fmt(n: number): string {
  return n.toLocaleString("sv-SE");
}
const sek = (n: number) => `${fmt(Math.round(n))} kr`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/55">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", strong ? "text-emerald-400" : "text-white")}>
        {value}
      </span>
    </div>
  );
}

export function EstimateResultCard({ result }: { result: ConstructionEstimateResult }) {
  return (
    <Card variant="elevated" padding="md">
      <CardHeader title="Kalkyl" description={`Motor: ${result.engineVersion}`} />
      <div className="divide-y divide-white/[0.05]">
        <Row label="Materialkostnad" value={sek(result.materialCostSek)} />
        <Row label="Arbetskostnad" value={sek(result.labourCostSek)} />
        <Row label="Delsumma (exkl. moms)" value={sek(result.subtotalSek)} />
        <Row label="Moms (25 %)" value={sek(result.vatSek)} />
        <Row label="ROT-avdrag" value={sek(result.rotDeductionSek)} />
        <Row label="Att betala" value={sek(result.totalSek)} strong />
      </div>
    </Card>
  );
}
