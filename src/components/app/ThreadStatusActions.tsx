"use client";

/**
 * ThreadStatusActions — manuella status-transitioner för en tråd.
 *
 * Två CTA:n:
 *   - Markera som löst   → status = "resolved"
 *   - Eskalera           → status = "escalated"
 *
 * Båda är alltid synliga men disablade när transitionen inte är meningsfull
 * (t.ex. redan löst/eskalerad). Audit-loggas via PATCH-routen.
 *
 * Triggar router.refresh() + toast vid success — utseendet på sidan
 * uppdateras direkt utan full page-reload.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useGlobalToast } from "@/components/ui/Toast";

type ThreadStatus = "open" | "waiting" | "escalated" | "resolved";

export function ThreadStatusActions({
  threadId,
  status,
}: {
  threadId: string;
  status:   ThreadStatus;
}) {
  const router = useRouter();
  const toast = useGlobalToast();
  const [pending, setPending] = useState<"resolve" | "escalate" | null>(null);

  const isResolved   = status === "resolved";
  const isEscalated  = status === "escalated";

  const call = async (next: "resolved" | "escalated") => {
    setPending(next === "resolved" ? "resolve" : "escalate");
    try {
      const res = await fetch(`/api/app/threads/${threadId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Åtgärden misslyckades");
      toast.success(next === "resolved" ? "Tråd markerad som löst" : "Tråd eskalerad");
      router.refresh();
    } catch (e) {
      toast.error("Kunde inte uppdatera tråden", {
        detail: e instanceof Error ? e.message : "Okänt fel",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => call("resolved")}
        disabled={isResolved || pending !== null}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-green-300 hover:text-green-200 border border-green-500/20 hover:border-green-500/40 hover:bg-green-500/[0.06] transition-colors disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40"
        aria-label="Markera tråden som löst"
        title={isResolved ? "Tråden är redan löst" : "Markera som löst"}
      >
        <CheckCircle2 size={13} aria-hidden />
        {pending === "resolve" ? "Sparar…" : "Markera som löst"}
      </button>
      <button
        type="button"
        onClick={() => call("escalated")}
        disabled={isEscalated || pending !== null}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.06] transition-colors disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        aria-label="Eskalera till människa"
        title={isEscalated ? "Tråden är redan eskalerad" : "Eskalera till människa"}
      >
        <AlertTriangle size={13} aria-hidden />
        {pending === "escalate" ? "Eskalerar…" : "Eskalera"}
      </button>
    </div>
  );
}
