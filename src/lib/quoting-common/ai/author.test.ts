/**
 * Tests for quoting-common AI authoring layer (draftQuote).
 *
 * All tests mock the Anthropic client — no real API calls are made.
 * The mock is hoisted via vi.mock so imports resolve correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock variables so they're available inside vi.mock factory ──────────
// vi.mock() is hoisted to the top of the file by Vitest; any variable referenced
// inside its factory must be declared via vi.hoisted() to avoid a TDZ error.

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

// ── Mock Anthropic SDK before importing the module under test ─────────────────

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(_opts: Record<string, unknown>) { /* ignore */ }
    messages = { create: mockCreate };
  },
}));

// ── Env setup ─────────────────────────────────────────────────────────────────

// Set a dummy key so getClient() doesn't throw before the mock kicks in.
// The actual network call is intercepted by vi.mock above — no real request is made.
process.env.ANTHROPIC_API_KEY = "test-key-vitest";

// ── Import after mock is in place ─────────────────────────────────────────────

import { draftQuote } from "./author";
import type { AiDraftInput } from "./types";
import type { KbEntry } from "../domain/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTextResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

const BASE_KB_ENTRY: KbEntry = {
  id:             "kb-1",
  organizationId: "org-test",
  title:          "25-year warranty",
  body:           "We offer a 25-year production warranty on all panels.",
  category:       "spec",
  visibility:     "customer_facing",
  vertical:       "solar",
  source:         null,
  createdBy:      null,
  createdAt:      new Date("2025-01-01"),
  updatedAt:      new Date("2025-01-01"),
};

const VALID_RESPONSE_JSON = JSON.stringify({
  narrativeText:  "Vi installerar ett 10 kWp solcellssystem på ditt södertak.",
  proposedInputs: { kwp: 10, roofAzimuth: 180 },
  confidence:     0.85,
  riskFlags:      [],
  sourceEntryIds: ["kb-1"],
});

const BASE_INPUT: AiDraftInput = {
  orgId:        "org-test",
  quoteId:      "quote-1",
  vertical:     "solar",
  customerName: "Testsson",
  scopeBrief:   "Villa i Täby, 10 kWp södertak",
  kbEntries:    [BASE_KB_ENTRY],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockCreate.mockReset();
});

describe("draftQuote", () => {
  it("returns a valid AiDraftResult when the model responds with well-formed JSON", async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse(VALID_RESPONSE_JSON));

    const result = await draftQuote(BASE_INPUT);

    expect(result.narrativeText).toContain("solcellssystem");
    expect(result.proposedInputs).toEqual({ kwp: 10, roofAzimuth: 180 });
    expect(result.confidence).toBe(0.85);
    expect(result.riskFlags).toEqual([]);
    expect(result.sourceEntryIds).toEqual(["kb-1"]);
    expect(result.rawModel).toBeTruthy();
  });

  it("adds 'low_confidence' risk flag when confidence < 0.6", async () => {
    const lowConfJson = JSON.stringify({
      narrativeText:  "Osäker offert.",
      proposedInputs: {},
      confidence:     0.4,
      riskFlags:      [],
      sourceEntryIds: [],
    });
    mockCreate.mockResolvedValueOnce(makeTextResponse(lowConfJson));

    const result = await draftQuote(BASE_INPUT);

    expect(result.confidence).toBe(0.4);
    expect(result.riskFlags).toContain("low_confidence");
  });

  it("returns parse_failed flag without throwing when model returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse("This is not JSON at all!"));

    const result = await draftQuote(BASE_INPUT);

    expect(result.riskFlags).toContain("parse_failed");
    expect(result.confidence).toBe(0);
    // narrativeText falls back to the raw text since it's non-empty
    expect(typeof result.narrativeText).toBe("string");
  });

  it("includes promptFragments in the system prompt sent to the model", async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse(VALID_RESPONSE_JSON));

    const inputWithFragments: AiDraftInput = {
      ...BASE_INPUT,
      promptFragments: ["Fokus på ROT-avdrag.", "Nämn 25-årsgarantin."],
    };

    await draftQuote(inputWithFragments);

    const callArgs = mockCreate.mock.calls[0][0];
    const systemText = (callArgs.system as { text: string }[])[0].text;

    expect(systemText).toContain("Fokus på ROT-avdrag.");
    expect(systemText).toContain("Nämn 25-årsgarantin.");
  });

  it("uses only caller-injected kbEntries (no internal-fetching)", async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse(VALID_RESPONSE_JSON));

    // Pass a single specific KB entry and verify it appears in the prompt
    const specificEntry: KbEntry = {
      ...BASE_KB_ENTRY,
      id:    "kb-specific",
      title: "Unique warranty clause",
      body:  "UNIQUE_BODY_CONTENT_XYZ",
    };

    await draftQuote({ ...BASE_INPUT, kbEntries: [specificEntry] });

    const callArgs = mockCreate.mock.calls[0][0];
    const systemText = (callArgs.system as { text: string }[])[0].text;

    // The injected entry must appear verbatim in the system prompt
    expect(systemText).toContain("UNIQUE_BODY_CONTENT_XYZ");
    // The original BASE_KB_ENTRY should NOT appear (different body)
    expect(systemText).not.toContain("25-year production warranty");
  });
});
