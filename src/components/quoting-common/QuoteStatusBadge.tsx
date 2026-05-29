"use client";

/**
 * Small status chip for a quote. Color-codes each status.
 * No external dependencies beyond tailwind + cn().
 */

import { cn } from "@/lib/utils";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft:       "bg-white/[0.06] text-white/60",
  calculating: "bg-blue-500/10 text-blue-300",
  ready:       "bg-cyan-500/10 text-cyan-300",
  sent:        "bg-violet-500/10 text-violet-300",
  viewed:      "bg-indigo-500/10 text-indigo-300",
  accepted:    "bg-emerald-500/10 text-emerald-300",
  signed:      "bg-emerald-600/10 text-emerald-200",
  rejected:    "bg-red-500/10 text-red-400",
  expired:     "bg-orange-500/10 text-orange-400",
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:       "Utkast",
  calculating: "Beräknar",
  ready:       "Klar",
  sent:        "Skickad",
  viewed:      "Öppnad",
  accepted:    "Accepterad",
  signed:      "Signerad",
  rejected:    "Avvisad",
  expired:     "Utgången",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
        STATUS_STYLES[status] ?? "bg-white/[0.06] text-white/50",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
