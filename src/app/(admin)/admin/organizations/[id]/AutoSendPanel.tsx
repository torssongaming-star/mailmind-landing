"use client";

import { useTransition } from "react";
import { toggleAutoSendAction } from "@/lib/admin/actions";
import { DRY_RUN_THRESHOLD } from "@/lib/admin/constants";
import { Zap, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AutoSendPanel({
  orgId,
  autoSendEnabled,
  approved,
}: {
  orgId:            string;
  autoSendEnabled:  boolean;
  /** Number of approved dry-run iterations */
  approved:         number;
}) {
  const [isPending, startTransition] = useTransition();
  const threshold = DRY_RUN_THRESHOLD;
  const unlocked  = approved >= threshold;

  const toggle = () => {
    if (!unlocked) return;
    startTransition(async () => {
      await toggleAutoSendAction(orgId, !autoSendEnabled);
    });
  };

  return (
    <div className={cn(
      "bg-[#050B1C] border rounded-2xl p-8 space-y-5",
      unlocked ? "border-white/5" : "border-white/5 opacity-60"
    )}>
      <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
        <Zap className="w-5 h-5 text-yellow-400" />
        Autosvar
      </h2>

      {/* Lock notice when dry-run threshold not met */}
      {!unlocked && (
        <div className="flex items-start gap-3 px-3 py-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
          <Lock className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-yellow-400/80 text-xs leading-relaxed">
            Autosvar kräver minst <strong className="text-yellow-400">{threshold}</strong> godkända dry-run-iterationer.
            {" "}Nuvarande: <strong className="text-yellow-400">{approved}</strong>.
          </p>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">
            {autoSendEnabled ? "Aktiverat" : "Inaktiverat"}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {autoSendEnabled
              ? "AI skickar godkända svar direkt utan mänsklig granskning."
              : "Utkast stannar i granskningskön tills agenten skickar."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={isPending || !unlocked}
          title={!unlocked ? `Kräver ${threshold} godkända dry-run-iterationer` : undefined}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50",
            autoSendEnabled ? "bg-yellow-400" : "bg-white/10",
            !unlocked && "cursor-not-allowed"
          )}
        >
          {isPending && (
            <Loader2 className="absolute inset-0 m-auto w-3.5 h-3.5 text-black animate-spin" />
          )}
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            autoSendEnabled ? "translate-x-6" : "translate-x-1",
            isPending && "opacity-0"
          )} />
        </button>
      </div>

      {/* Rules reminder */}
      {unlocked && (
        <div className="pt-2 border-t border-white/5 space-y-1">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">
            Aktiva säkerhetsregler
          </p>
          {[
            "Confidence ≥ 90 %",
            "Källgrundat svar",
            "Risknivå = låg",
            "Ej ny kund (≥ 3 interaktioner)",
          ].map(rule => (
            <div key={rule} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 shrink-0" />
              {rule}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
