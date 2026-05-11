"use client";

import { useState } from "react";
import { ShieldOff, Check, Loader2 } from "lucide-react";

export function BlockSenderButton({ fromEmail }: { fromEmail: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "already">("idle");
  const [error, setError] = useState<string | null>(null);

  const block = async () => {
    setState("pending");
    setError(null);
    try {
      const res = await fetch("/api/app/blocklist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pattern: fromEmail }),
      });
      if (res.status === 409) { setState("already"); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Misslyckades");
      }
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <Check className="w-3.5 h-3.5" />
        Blockerad
      </span>
    );
  }

  if (state === "already") {
    return (
      <span className="text-xs text-muted-foreground italic">Redan blockerad</span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={block}
        disabled={state === "pending"}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 transition-colors disabled:opacity-40"
      >
        {state === "pending"
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <ShieldOff className="w-3 h-3" />}
        Blockera avsändare
      </button>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
