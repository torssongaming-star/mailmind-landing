import { Sun } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Solar" };

export default function SolarPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <Sun size={28} className="text-amber-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">Solar-modulen aktiveras</h2>
        <p className="text-sm text-white/60 mt-1">Funktioner kommer i S1.</p>
      </div>
    </div>
  );
}
