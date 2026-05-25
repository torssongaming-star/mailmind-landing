"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, X } from "lucide-react";

interface Props {
  used:  number;
  limit: number;
}

export function DraftsBanner({ used, limit }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const pct = Math.round((used / limit) * 100);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] shadow-[0_2px_24px_-12px_rgba(251,191,36,0.4)] px-5 py-4 backdrop-blur-sm">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <TrendingUp size={16} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{pct}% av din AI-kvot använd</p>
        <p className="text-xs text-white/70 leading-relaxed mt-0.5">
          Du har använt {used} av {limit} AI-utkast den här månaden.{" "}
          <Link href="/dashboard/billing" className="underline hover:text-white/80 transition-colors">
            Se planer →
          </Link>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Stäng"
        className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
