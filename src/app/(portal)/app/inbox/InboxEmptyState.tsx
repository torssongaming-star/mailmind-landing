"use client";

import { useState } from "react";
import { Inbox, Copy, Check } from "lucide-react";

interface Props {
  inboxEmail: string | null;
}

export function InboxEmptyState({ inboxEmail }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    if (!inboxEmail) return;
    await navigator.clipboard.writeText(inboxEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Inbox size={24} className="text-white/40" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-white/80">Inga e-postmeddelanden ännu</p>
        <p className="text-xs text-white/65 max-w-xs leading-relaxed">
          Skicka ett testmejl till din inkorg för att se hur Mailmind triagerar det.
        </p>
      </div>
      {inboxEmail && (
        <button
          onClick={copyEmail}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:bg-white/8 hover:text-white/80 transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {copied ? "Kopierat!" : inboxEmail}
        </button>
      )}
    </div>
  );
}
