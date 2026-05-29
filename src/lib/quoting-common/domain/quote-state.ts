/**
 * Quote state machine.
 *
 * Pure functions — no I/O, no DB. Trivially unit-testable.
 *
 * Valid transitions (modelled after a real Swedish quoting workflow):
 *
 *   draft        → calculating, ready, rejected
 *   calculating  → draft, ready, rejected
 *   ready        → sent, rejected
 *   sent         → viewed, expired, rejected
 *   viewed       → accepted, rejected, expired
 *   accepted     → signed, rejected
 *   signed       → (terminal)
 *   rejected     → (terminal)
 *   expired      → (terminal)
 *
 * "rejected" is the universal soft-delete — any non-terminal status can
 * transition there. Terminal statuses accept no further transitions.
 */

import type { QuoteStatus } from "./types";

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft:       ["calculating", "ready", "rejected"],
  calculating: ["draft", "ready", "rejected"],
  ready:       ["sent", "rejected"],
  sent:        ["viewed", "expired", "rejected"],
  viewed:      ["accepted", "rejected", "expired"],
  accepted:    ["signed", "rejected"],
  signed:      [],
  rejected:    [],
  expired:     [],
};

/**
 * Returns `true` if the transition from → to is allowed by the state machine.
 */
export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns the set of statuses reachable from the given status.
 * Useful for building transition dropdowns in the UI.
 */
export function allowedTransitions(from: QuoteStatus): QuoteStatus[] {
  return QUOTE_TRANSITIONS[from] ?? [];
}

/**
 * Returns `true` if the status is terminal (no further transitions allowed).
 */
export function isTerminal(status: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[status].length === 0;
}
