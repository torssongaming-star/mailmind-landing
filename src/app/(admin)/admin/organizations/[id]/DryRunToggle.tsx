"use client";

import React, { useState, useTransition } from "react";
import { Zap, Loader2 } from "lucide-react";
import { toggleDryRunAction } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

export default function DryRunToggle({ 
  organizationId, 
  initialEnabled 
}: { 
  organizationId: string; 
  initialEnabled: boolean 
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = async () => {
    const nextValue = !enabled;
    setEnabled(nextValue);
    
    startTransition(async () => {
      const result = await toggleDryRunAction(organizationId, nextValue);
      if (!result.success) {
        setEnabled(enabled); // Rollback
        alert("Failed to update dry-run setting");
      }
    });
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
          enabled 
            ? "bg-yellow-500/10 border-yellow-500/20" 
            : "bg-slate-500/10 border-white/5"
        )}>
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : (
            <Zap className={cn("w-5 h-5 transition-colors", enabled ? "text-yellow-500" : "text-slate-600")} />
          )}
        </div>
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            Dry-Run Mode
            {enabled && (
              <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[8px] font-black uppercase rounded-sm">Enabled</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Safety mode: drafts won't be sent</div>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          "w-12 h-6 rounded-full p-1 transition-all duration-300 relative",
          enabled ? "bg-yellow-500" : "bg-slate-700"
        )}
      >
        <div className={cn(
          "w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-lg",
          enabled ? "translate-x-6" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}
