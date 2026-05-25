/**
 * DraftSources — visar vilka kunskapsbas-poster ett AI-utkast bygger på.
 *
 * Visar antingen:
 *   - Källista med snippet + KB-id per källa (när AI hänvisat till KB)
 *   - Varningsruta "Ingen källhänvisning" (när sources är tomt)
 *
 * Tomt-tillståndet är medvetet — det är inte en bug att visa "ingen källa",
 * det är en trygghetssignal: en SMB-användare ska direkt se om AI:n hittade
 * på svaret eller bygger på företagets kunskapsbas. Detta är ett av tre
 * LOCKED produktbeslut (källgrundat-villkoret för auto-send).
 *
 * Används från:
 *   - inbox/ThreadPanel.tsx (split-vy)
 *   - thread/[id]/page.tsx (full-vy)
 */

export type DraftSource = {
  kb_entry_id: string;
  snippet:     string;
};

export function DraftSources({ sources }: { sources: DraftSource[] }) {
  // ── Tomt-tillstånd: AI hänvisade inte till någon källa ──────────────────
  if (sources.length === 0) {
    return (
      <div className="border-t border-white/5 pt-3">
        <div className="rounded-md bg-amber-500/[0.05] border border-amber-500/20 px-3 py-2 flex items-start gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-400 shrink-0 mt-0.5"
            aria-hidden
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" />
          </svg>
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-amber-200 leading-none">
              Ingen källhänvisning
            </p>
            <p className="text-[11px] text-amber-200/70 leading-relaxed">
              AI:n hänvisade inte till någon post i kunskapsbasen — granska
              extra noga innan du skickar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Med källor ─────────────────────────────────────────────────────────
  return (
    <div className="border-t border-white/5 pt-3 space-y-1.5">
      <p className="text-[10px] text-white/45 uppercase tracking-widest font-semibold flex items-center gap-1.5">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        Källor ({sources.length})
      </p>
      <ul className="space-y-1.5">
        {sources.map((s, i) => (
          <li
            key={i}
            className="rounded-md bg-black/20 border border-white/5 px-2.5 py-1.5"
          >
            <p className="text-[11px] text-white/70 leading-relaxed">
              &ldquo;{s.snippet}&rdquo;
            </p>
            {s.kb_entry_id !== "thread" && s.kb_entry_id !== "history" && (
              <p className="text-[9px] text-white/30 mt-0.5 font-mono">
                KB · {s.kb_entry_id.slice(0, 8)}…
              </p>
            )}
            {(s.kb_entry_id === "thread" || s.kb_entry_id === "history") && (
              <p className="text-[9px] text-white/30 mt-0.5">Från tråden</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
