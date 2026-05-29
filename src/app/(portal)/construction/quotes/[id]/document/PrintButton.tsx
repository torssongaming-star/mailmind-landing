"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-primary/90 transition-all"
    >
      <Printer size={15} />
      Spara som PDF
    </button>
  );
}
