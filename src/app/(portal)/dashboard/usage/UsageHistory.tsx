"use client";

type DataPoint = {
  month:     string; // "2026-05"
  aiDrafts:  number;
  emails:    number;
};

function formatMonth(iso: string): string {
  const [year, month] = iso.slice(0, 7).split("-");
  const names = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  return `${names[parseInt(month, 10) - 1]} ${year}`;
}

export function UsageHistory({
  data,
  draftsLimit,
}: {
  data: DataPoint[];
  draftsLimit: number;
}) {
  const sorted     = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const maxDrafts  = Math.max(...sorted.map(d => d.aiDrafts), 1);
  const chartMax   = Math.max(maxDrafts, draftsLimit * 0.5);

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <div className="flex items-end gap-2 h-32">
        {sorted.map(d => {
          const barPct    = chartMax > 0 ? (d.aiDrafts / chartMax) * 100 : 0;
          const limitPct  = chartMax > 0 ? (draftsLimit / chartMax) * 100 : 100;
          const isWarning = draftsLimit > 0 && d.aiDrafts / draftsLimit >= 0.8;
          const isFull    = draftsLimit > 0 && d.aiDrafts >= draftsLimit;

          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <p className="font-semibold">{formatMonth(d.month)}</p>
                <p>{d.aiDrafts} AI-svar</p>
                {d.emails > 0 && <p>{d.emails} mejl</p>}
              </div>

              {/* Bar */}
              <div className="w-full flex-1 flex items-end relative">
                {/* Limit line */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-white/15"
                  style={{ bottom: `${limitPct}%` }}
                />
                {/* Draft bar */}
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isFull ? "bg-red-400/70" : isWarning ? "bg-amber-400/70" : "bg-primary/60 group-hover:bg-primary/80"
                  }`}
                  style={{ height: `${Math.max(barPct, barPct > 0 ? 2 : 0)}%` }}
                />
              </div>

              {/* Label */}
              <p className="text-[9px] text-muted-foreground text-center leading-tight">
                {formatMonth(d.month).split(" ")[0]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Table summary */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/8">
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">Månad</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium">AI-svar</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium">% av plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[...sorted].reverse().map(d => {
              const pct = draftsLimit > 0 ? Math.round((d.aiDrafts / draftsLimit) * 100) : 0;
              return (
                <tr key={d.month} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2 text-white">{formatMonth(d.month)}</td>
                  <td className="px-4 py-2 text-right text-white tabular-nums">
                    {d.aiDrafts.toLocaleString("sv-SE")}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${
                    pct >= 100 ? "text-red-400" : pct >= 80 ? "text-amber-400" : "text-muted-foreground"
                  }`}>
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Streckad linje = plangräns ({draftsLimit.toLocaleString("sv-SE")} svar/mån)
      </p>
    </div>
  );
}
