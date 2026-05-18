"use client";

import { useState, useRef } from "react";
import { updatePersonalSignature } from "./actions";

export function PersonalSignatureEditor({ initialSignature }: { initialSignature: string | null }) {
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus]       = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    const currentSignature = editorRef.current?.innerHTML ?? "";
    const hasChanged = currentSignature.trim() !== (initialSignature ?? "").trim();
    if (!hasChanged) {
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    setIsPending(true);
    setStatus("idle");
    setErrorMsg(null);

    try {
      const res = await updatePersonalSignature(currentSignature);
      if (res && !res.ok) {
        throw new Error(res.error || "Ett oväntat fel uppstod");
      }
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
              Din signatur (stödjer bilder och länkar)
            </label>
            <div
              ref={editorRef}
              contentEditable
              dangerouslySetInnerHTML={{ __html: initialSignature ?? "" }}
              className="w-full min-h-[120px] rounded-xl bg-[#0A1025] border border-white/10 px-4 py-3 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-all overflow-auto"
            />
            <p className="text-xs text-slate-500 mt-2">
              Du kan kopiera och klistra in din befintliga e-postsignatur här för att behålla dess formatering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
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
