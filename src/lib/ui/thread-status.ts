/**
 * Delade UI-tokens för thread-status-badges.
 *
 * Tidigare duplicerades samma färgmappning ord-för-ord i InboxList,
 * ThreadPanel och CustomerHistory. Att lägga den här gör det möjligt att:
 *   1. Ändra färgsystemet på ett ställe (kontrast-svep, branding-skifte)
 *   2. Lägga till nya status utan att leta efter copies
 *   3. Återanvända samma styling i nya komponenter
 *
 * Värdet är Tailwind-klasser direkt — designsystemets tokens
 * (cyan/amber/red/white) finns redan i theme.
 */

export type ThreadStatus = "open" | "waiting" | "escalated" | "resolved";

export const THREAD_STATUS_CLASSES: Record<string, string> = {
  open:      "bg-green-500/15 text-green-400 border-green-500/30",
  waiting:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  escalated: "bg-red-500/15 text-red-400 border-red-500/30",
  resolved:  "bg-white/10 text-muted-foreground border-white/15",
};

/** Säker accessor — okänd status faller tillbaka till "resolved"-styling. */
export function threadStatusClass(status: string | null | undefined): string {
  if (!status) return THREAD_STATUS_CLASSES.resolved;
  return THREAD_STATUS_CLASSES[status] ?? THREAD_STATUS_CLASSES.resolved;
}
