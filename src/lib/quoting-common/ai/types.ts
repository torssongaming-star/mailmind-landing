/**
 * Quoting-common AI authoring layer — shared types.
 *
 * Client-safe: no server-only imports.
 */

import type { KbEntry } from "../domain/types";

// ── Input ─────────────────────────────────────────────────────────────────────

export type AiDraftInput = {
  /** Org ID — for tracing/logging only; no DB access inside the AI layer */
  orgId:        string;
  /** Quote ID — for tracing/logging only */
  quoteId:      string;
  /** Vertical discriminator: 'solar' | 'construction' | 'trades' */
  vertical:     string;
  /** End-customer name for personalisation */
  customerName: string;
  /**
   * Free-text scope description from the salesperson.
   * E.g. "Villa i Täby, 180 m² södertak, förbrukning ca 12 000 kWh/år"
   */
  scopeBrief:   string;
  /**
   * Customer-facing KB entries, pre-filtered by the caller.
   * The AI layer NEVER fetches its own KB — the caller injects entries
   * so it can enforce audience classification before this function runs.
   */
  kbEntries:      KbEntry[];
  /**
   * Vertical-specific prompt fragments (vocabulary, examples).
   * Injected by the vertical's module (e.g. lib/solar/ai-prompts/solar.ts).
   */
  promptFragments?: string[];
};

// ── Result ────────────────────────────────────────────────────────────────────

export type AiDraftResult = {
  /** Customer-facing quote narrative text */
  narrativeText:   string;
  /**
   * Structured engine inputs proposed by the AI.
   * Shape depends on the vertical — caller validates against the vertical's
   * engine inputSchema (e.g. SolarEngineInputSchema.safeParse).
   */
  proposedInputs:  Record<string, unknown>;
  /** Confidence 0–1 that the draft is accurate and complete */
  confidence:      number;
  /**
   * Risk flags, e.g. 'low_confidence', 'missing_consumption',
   * 'missing_roof_details', 'parse_failed'.
   */
  riskFlags:       string[];
  /** IDs of KB entries the model cited (best-effort) */
  sourceEntryIds:  string[];
  /** Model ID used for this generation */
  rawModel:        string;
};
