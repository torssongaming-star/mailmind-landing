"use client";

import { useTransition } from "react";
import { toggleDryRunAction } from "@/lib/admin/actions";
import { DRY_RUN_THRESHOLD } from "@/lib/admin/constants";
import { FlaskConical, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DryRunPanel({
  orgId,
  dryRunEnabled,
  approved,
  total,
  pending,
}: {
  orgId: string;
  dryRunEnabled: boolean;
  approved: number;
  total: number;
  pending: number;
}) {
  const [isPending, startTransition] = useTransition();
  const threshold = DRY_RUN_THRESHOLD;
  const pct       = Math.min(100, Math.round((approved / threshold) * 100));
  const ready     = approved >= threshold;

  const toggle = () => {
    startTransition(async () => {
      await toggleDryRunAction(orgId, !dryRunEnabled);
    });
  };

  return (
    <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
      <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
        <FlaskConical className="w-5 h-5 text-primary" />
        Dry-run-läge
      </h2>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">
            {dryRunEnabled ? "Aktivt" : "Inaktivt"}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {dryRunEnabled
              ? "AI genererar utkast men skickar ingenting till kunden."
              : "Aktivera för att börja samla dry-run-iterationer."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={isPending}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50",
            dryRunEnabled ? "bg-primary" : "bg-white/10"
          )}
        >
          {isPending && (
            <Loader2 className="absolute inset-0 m-auto w-3.5 h-3.5 text-black animate-spin" />
          )}
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            dryRunEnabled ? "translate-x-6" : "translate-x-1",
            isPending && "opacity-0"
          )} />
        </button>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Godkända iterationer</span>
          <span className={cn("font-bold", ready ? "text-green-400" : "text-white")}>
            {approved} / {threshold}
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              ready
                ? "bg-gradient-to-r from-green-500 to-emerald-400"
                : "bg-gradient-to-r from-primary to-cyan-300"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-600">
          <span>{total} genererade · {pending} väntar granskning</span>
          {ready && <span className="text-green-400 font-bold">Klar ✓</span>}
        </div>
      </div>

      {/* Link to review page */}
      <Link
        href={`/admin/organizations/${orgId}/dry-run`}
        className="flex items-center justify-between w-full px-4 py-3 bg-white/[0.02] hover:bg-white/5 border border-white/10 rounded-xl transition-colors group"
      >
        <span className="text-slate-300 text-xs font-medium group-hover:text-white transition-colors">
          Granska dry-run-utkast ({total})
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-primary transition-colors" />
      </Link>
    </div>
  );
}
