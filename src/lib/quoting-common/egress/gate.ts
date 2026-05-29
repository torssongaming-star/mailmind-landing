/**
 * Quoting-common — egress gate (Phase S2-5).
 *
 * The egress gate enforces audience classification before any KB content
 * is included in customer-visible output (quote PDF, email, portal text).
 *
 * Design principles (§13.4):
 *   1. Fail-safe: unknown or internal_only entries are BLOCKED by default.
 *   2. Explicit allow-list: only entries with visibility = 'customer_facing'
 *      pass through.
 *   3. Pure function: no I/O, fully testable, no side effects.
 *
 * Usage:
 *   const safe = filterCustomerFacing(entries);
 *   const text = extractBodies(entries, { maxEntries: 5 });
 */

import type { KbEntry, KbVisibility } from "../domain/types";

// ── Core filter ───────────────────────────────────────────────────────────────

/**
 * Returns only entries explicitly marked `customer_facing`.
 * All other visibility values (including unknown future values) are blocked.
 */
export function filterCustomerFacing(entries: KbEntry[]): KbEntry[] {
  return entries.filter(isCustomerFacing);
}

/**
 * Predicate: is this entry safe to include in customer-visible output?
 * Exported so callers can use it as a type-guard or in their own filters.
 */
export function isCustomerFacing(entry: KbEntry): boolean {
  return entry.visibility === ("customer_facing" satisfies KbVisibility);
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export type ExtractOptions = {
  /** Maximum entries to include (default: no limit) */
  maxEntries?: number;
  /** Filter to a specific vertical (null/undefined = all) */
  vertical?:   string | null;
};

/**
 * Filter + extract body text for customer-facing entries.
 * Returns an array of strings ready for prompt injection or PDF rendering.
 * Applies `maxEntries` cap AFTER vertical filtering.
 */
export function extractBodies(
  entries:  KbEntry[],
  options?: ExtractOptions,
): string[] {
  let safe = filterCustomerFacing(entries);

  if (options?.vertical !== undefined && options.vertical !== null) {
    safe = safe.filter(
      (e) => e.vertical === null || e.vertical === options.vertical,
    );
  }

  if (options?.maxEntries !== undefined) {
    safe = safe.slice(0, options.maxEntries);
  }

  return safe.map((e) => e.body);
}

/**
 * Returns a map of entryId → blocked reason for any entries that would NOT
 * pass the egress gate. Useful for admin audit views.
 */
export function auditBlocked(
  entries: KbEntry[],
): Map<string, string> {
  const blocked = new Map<string, string>();
  for (const entry of entries) {
    if (!isCustomerFacing(entry)) {
      blocked.set(
        entry.id,
        `visibility=${entry.visibility} — not customer_facing`,
      );
    }
  }
  return blocked;
}

// ── Rendered-text scan ────────────────────────────────────────────────────────

export type EgressInput  = { renderedText: string };
export type EgressResult = { ok: boolean; blockedReasons: string[] };

/**
 * Placeholder patterns that must never appear in customer-visible output.
 * Two expressions: word-boundary anchored for bare words, literal for brackets.
 */
const PLACEHOLDER_WORD_RE    = /\b(TODO|FIXME)\b/i;
const PLACEHOLDER_BRACKET_RE = /\[FYLL I\]|\[INSERT\]|\[DATUM\]/i;

/**
 * Full egress gate — scans rendered output before it leaves the system.
 *
 * Pure function: no DB access. Callers must inject:
 *   - `internalEntries` — the org's KB entries with `visibility = 'internal_only'`
 *
 * Rules applied:
 *   1. Internal-data scan: if renderedText contains a substring from any
 *      internal_only entry body (first 60 chars, case-insensitive) → blocked.
 *   2. Placeholder scan: TODO / FIXME / [FYLL I] / [INSERT] / [DATUM] → blocked.
 *
 * `ok = true` only when no rules fire.
 */
export function runEgressGate(
  input:           EgressInput,
  internalEntries: KbEntry[],
): EgressResult {
  const blockedReasons: string[] = [];
  const text = input.renderedText;

  // Rule 1 — internal-data scan
  const internalOnly = internalEntries.filter((e) => !isCustomerFacing(e));
  const textLower    = text.toLowerCase();
  for (const entry of internalOnly) {
    const snippet = entry.body.slice(0, 60).trim();
    if (snippet.length > 10 && textLower.includes(snippet.toLowerCase())) {
      blockedReasons.push("internal_data_detected");
      break; // one flag is enough — don't spam multiple identical reasons
    }
  }

  // Rule 2 — placeholder scan
  if (PLACEHOLDER_WORD_RE.test(text) || PLACEHOLDER_BRACKET_RE.test(text)) {
    blockedReasons.push("placeholder_detected");
  }

  return { ok: blockedReasons.length === 0, blockedReasons };
}
