"use client";

import { useState, useRef } from "react";
import { updatePersonalSignature, updateAppendSignature } from "./actions";

export function PersonalSignatureEditor({
  initialSignature,
  initialAppendSignature,
}: {
  initialSignature: string | null;
  initialAppendSignature: boolean;
}) {
  const [isPending, setIsPending]         = useState(false);
  const [status, setStatus]               = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [appendSig, setAppendSig]         = useState(initialAppendSignature);
  const [togglePending, setTogglePending] = useState(false);
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

  const handleToggle = async () => {
    const newValue = !appendSig;
    setAppendSig(newValue);
    setTogglePending(true);
    try {
      await updateAppendSignature(newValue);
    } catch {
      setAppendSig(!newValue); // Revert on failure
    } finally {
      setTogglePending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-6 md:p-8 backdrop-blur-sm">
      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-white">Personlig e-postsignatur</h2>
        <p className="text-sm text-slate-400 mt-1">
          Din HTML-signatur läggs till längst ner i mejl när du godkänner AI-utkast.
        </p>

        <div className="mt-6 space-y-5">
          {/* Signature Editor */}
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
              Kopiera och klistra in din befintliga e-postsignatur för att behålla formateringen.
            </p>
          </div>

          {/* Toggle: Bifoga signatur i AI-utkast */}
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Bifoga signatur i AI-utkast</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {appendSig
                  ? "Din signatur läggs till automatiskt när du skickar AI-svar."
                  : "Din signatur bifogas inte automatiskt. Du kan aktivera det när som helst."}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={togglePending}
              aria-checked={appendSig}
              role="switch"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50 ${
                appendSig
                  ? "border-cyan-400/40 bg-cyan-400"
                  : "border-white/10 bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform duration-200 ease-in-out mt-0.5 ${
                  appendSig ? "translate-x-5 bg-[#030614]" : "translate-x-0.5 bg-white/60"
                }`}
              />
            </button>
          </div>

          {/* Save button */}
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
