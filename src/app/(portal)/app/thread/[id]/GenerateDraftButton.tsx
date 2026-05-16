"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function GenerateDraftButton({
  threadId,
  onDone,
}: {
  threadId: string;
  onDone?:  () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleGenerate = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/app/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Genereringen misslyckades");
      }
      router.refresh();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleGenerate}
        disabled={pending}
        className="group relative inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-xs font-semibold transition-all duration-200 hover:bg-cyan-300 hover:shadow-[0_4px_22px_-2px_hsl(189_94%_43%/0.5)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-base))]"
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Genererar utkast…
          </>
        ) : (
          <>
            <Sparkles size={13} className="transition-transform duration-300 group-hover:scale-110" />
            Generera AI-utkast
          </>
        )}
      </button>
      {pending && (
        <p className="text-[10px] text-white/40 animate-pulse">Tar oftast 2–5 sekunder</p>
      )}
      {error && (
        <p className="text-[10px] text-red-400 max-w-[260px] text-right">{error}</p>
      )}
    </div>
  );
}
