/**
 * Deterministisk färgmappning per case-type-slug.
 *
 * Använder en enkel hash av sluggen för att alltid ge samma slug samma färg
 * — så att en användare lär sig att "blå prick = bokning, grön = fråga" osv.
 * utan att läsa texten varje gång.
 *
 * "bulk" hanteras separat med neutral grå — det är inte en riktig case-typ
 * utan en flagga för auto-filtrerad reklam.
 */

const PALETTE: { dot: string; ring: string }[] = [
  { dot: "bg-primary",        ring: "ring-primary/30" },    // cyan
  { dot: "bg-purple-400",     ring: "ring-purple-400/30" },
  { dot: "bg-amber-400",      ring: "ring-amber-400/30" },
  { dot: "bg-emerald-400",    ring: "ring-emerald-400/30" },
  { dot: "bg-pink-400",       ring: "ring-pink-400/30" },
  { dot: "bg-sky-400",        ring: "ring-sky-400/30" },
  { dot: "bg-orange-400",     ring: "ring-orange-400/30" },
  { dot: "bg-violet-400",     ring: "ring-violet-400/30" },
];

const BULK_COLOR = { dot: "bg-white/30", ring: "ring-white/10" };

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function caseTypeDotClasses(slug: string | null | undefined): { dot: string; ring: string } {
  if (!slug) return BULK_COLOR;
  if (slug === "bulk") return BULK_COLOR;
  return PALETTE[hashSlug(slug) % PALETTE.length];
}
