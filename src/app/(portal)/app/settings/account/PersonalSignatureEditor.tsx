"use client";

import { useState } from "react";
import { updatePersonalSignature } from "./actions";

export function PersonalSignatureEditor({ initialSignature }: { initialSignature: string | null }) {
  const [signature, setSignature] = useState(initialSignature ?? "");
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus]       = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  const hasChanged = signature.trim() !== (initialSignature ?? "").trim();

  const handleSave = async () => {
    if (!hasChanged) return;
    setIsPending(true);
    setStatus("idle");
    setErrorMsg(null);

    try {
      await updatePersonalSignature(signature);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Okänt fel uppstod");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-6 md:p-8 backdrop-blur-sm">
      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-white">Personlig e-postsignatur</h2>
        <p className="text-sm text-slate-400 mt-1">
          Denna signatur bifogas längst ner i mejl som du skickar eller när du godkänner AI-utkast.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Din signatur
            </label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={4}
              placeholder="Med vänliga hälsningar,&#10;Förnamn Efternamn&#10;Företag AB"
              className="w-full rounded-xl bg-[#0A1025] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-all resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanged || isPending}
              className="h-10 px-6 rounded-xl bg-cyan-400 text-black font-bold text-sm hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {isPending ? "Sparar..." : "Spara signatur"}
            </button>

            {status === "success" && (
              <span className="text-sm text-green-400 font-medium">Sparat!</span>
            )}
            {status === "error" && (
              <span className="text-sm text-red-400 font-medium">{errorMsg}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
