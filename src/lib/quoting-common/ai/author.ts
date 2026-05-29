/**
 * Quoting-common AI authoring layer.
 *
 * `draftQuote` is the single entry point. It:
 *   1. Builds a system prompt from KB entries + vertical prompt fragments.
 *   2. Calls claude-haiku with the salesperson's scope brief.
 *   3. Parses the structured JSON response.
 *   4. Returns AiDraftResult — NEVER throws.
 *
 * Design:
 *   - No DB access — caller injects KB entries (audience-classified).
 *   - Numbers for the customer come from the vertical engine, not this function.
 *   - Prompt cache_control: ephemeral on system prompt (5-min TTL).
 *   - Confidence < 0.6 → 'low_confidence' risk flag added.
 *   - Parse failure → 'parse_failed' flag, graceful degradation.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AiDraftInput, AiDraftResult } from "./types";

// ── Client (lazy-init, same pattern as lib/app/ai.ts) ─────────────────────────

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

const AI_MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_KB_ENTRIES = 8;
const CONFIDENCE_THRESHOLD = 0.6;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildSystemPrompt(input: AiDraftInput): string {
  const fragments = (input.promptFragments ?? []).join("\n");

  const kbSection = input.kbEntries.length > 0
    ? input.kbEntries
        .slice(0, MAX_KB_ENTRIES)
        .map((e) => `[${e.id}] ${e.title}\n${e.body}`)
        .join("\n\n")
    : "(Inga KB-poster tillgängliga.)";

  return `Du är en expert säljassistent för ${input.vertical}-offerter.
Din uppgift: analysera säljarens kortfattade brief och producera (1) en kundvändande offertext och (2) strukturerade motor-inputs för beräkningsmotorn.

${fragments ? `VERTIKAL-SPECIFIKA INSTRUKTIONER:\n${fragments}\n` : ""}
KUNDINFORMATION (customer_facing KB-poster — ENDA godkänd grunderingskälla):
${kbSection}

ABSOLUTA BEGRÄNSNINGAR:
- Uppfinn ALDRIG priser, kWh-tal, garantilängder eller ROT-belopp som inte framgår av briefen eller KB.
- Om ett värde saknas — flagga det i riskFlags istället för att gissa.
- Returnera ALLTID giltig JSON enligt schemat nedan.

SVARSFORMAT (returnera exakt detta JSON-objekt, inga markdown-omslag):
{
  "narrativeText": "<kundvändande offerttext på svenska>",
  "proposedInputs": { <strukturerade motor-inputs> },
  "confidence": <0.0–1.0>,
  "riskFlags": ["<flagga1>", "..."],
  "sourceEntryIds": ["<KB-post-id>", "..."]
}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function draftQuote(input: AiDraftInput): Promise<AiDraftResult> {
  const systemPrompt = buildSystemPrompt(input);
  const userMessage  = `Kund: ${input.customerName}\nBrief: ${input.scopeBrief}`;

  let rawText = "";

  try {
    const client = getClient();

    const response = await client.messages.create({
      model:      AI_MODEL,
      max_tokens: 2048,
      system: [
        {
          type:          "text",
          text:          systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Strip accidental markdown code fences
    rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    const parsed = JSON.parse(rawText) as {
      narrativeText:   string;
      proposedInputs:  Record<string, unknown>;
      confidence:      number;
      riskFlags:       string[];
      sourceEntryIds:  string[];
    };

    const confidence  = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0;
    const riskFlags   = Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [];

    if (confidence < CONFIDENCE_THRESHOLD) {
      riskFlags.push("low_confidence");
    }

    return {
      narrativeText:  typeof parsed.narrativeText === "string" ? parsed.narrativeText : rawText,
      proposedInputs: parsed.proposedInputs ?? {},
      confidence,
      riskFlags,
      sourceEntryIds: Array.isArray(parsed.sourceEntryIds) ? parsed.sourceEntryIds : [],
      rawModel:       AI_MODEL,
    };
  } catch {
    // Never throw — return graceful degradation result
    return {
      narrativeText:  rawText || "AI-utkastet kunde inte genereras. Fyll i manuellt.",
      proposedInputs: {},
      confidence:     0,
      riskFlags:      ["parse_failed"],
      sourceEntryIds: [],
      rawModel:       AI_MODEL,
    };
  }
}
