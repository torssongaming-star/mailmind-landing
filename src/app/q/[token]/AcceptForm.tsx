"use client";

/**
 * AcceptForm — customer-facing "accept and sign" control on the public quote.
 *
 * Captures the signer's name, posts to the public accept endpoint with the
 * share token, and shows a confirmation on success. No auth — the token in
 * the URL is the capability.
 */

import { useState } from "react";

type Labels = {
  title:           string;
  body:            string;
  namePlaceholder: string;
  signButton:      string;
  signing:         string;
  doneTitle:       string;
  doneBody:        string;
  nameRequired:    string;
  networkError:    string;
  signError:       string;
};

const SV: Labels = {
  title:           "Acceptera offerten",
  body:            "Genom att signera bekräftar du att du accepterar offerten enligt angivna villkor.",
  namePlaceholder: "För- och efternamn",
  signButton:      "Signera & acceptera",
  signing:         "Signerar…",
  doneTitle:       "Tack! Offerten är accepterad.",
  doneBody:        "Vi har registrerat din signering och återkommer inom kort.",
  nameRequired:    "Ange ditt namn för att signera.",
  networkError:    "Nätverksfel. Försök igen.",
  signError:       "Kunde inte signera. Försök igen.",
};

type Props = { token: string; labels?: Partial<Labels> };

export function AcceptForm({ token, labels }: Props) {
  const L = { ...SV, ...labels };
  const [name, setName]   = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) {
      setError(L.nameRequired);
      setPhase("error");
      return;
    }
    setPhase("submitting");
    try {
      const res = await fetch(`/api/public/quote/${encodeURIComponent(token)}/accept`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ signerName: name.trim() }),
      });
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? L.signError);
        setPhase("error");
        return;
      }
      setPhase("done");
    } catch {
      setError(L.networkError);
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-center">
        <p className="text-sm font-semibold text-emerald-800">{L.doneTitle}</p>
        <p className="text-xs text-emerald-700 mt-1">{L.doneBody}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5">
      <p className="text-sm font-semibold text-slate-800 mb-1">{L.title}</p>
      <p className="text-xs text-slate-500 mb-4">{L.body}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (phase === "error") setPhase("idle"); }}
          placeholder={L.namePlaceholder}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <button
          onClick={submit}
          disabled={phase === "submitting"}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {phase === "submitting" ? L.signing : L.signButton}
        </button>
      </div>
      {phase === "error" && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
