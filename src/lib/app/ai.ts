/**
 * AI service — Claude-powered email triage.
 *
 * Ports the prompt logic from the Electron prototype (projekt/src/services/aiService.js)
 * to the new schema. The AI returns one of three actions:
 *
 *   1. ask       — needs more info; bodyText = question to send to customer
 *   2. summarize — all required fields collected; bodyText = confirmation to customer,
 *                  metadata.summary = internal routed summary
 *   3. escalate  — out of scope or unclear; metadata.reason = why
 *
 * Output is strict JSON validated by Zod. On parse failure we fall back to
 * `escalate` so the agent gets a chance to handle it manually.
 *
 * Prompt caching note: the system prompt is built per call (depends on org's
 * case_types + tone). For Phase 3, cache the system prompt block when the org's
 * config hasn't changed — Anthropic supports cache_control.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type {
  AiSettings,
  CaseType,
  EmailMessage,
  EmailThread,
  KnowledgeEntry,
} from "@/lib/db/schema";

// ── Public types ──────────────────────────────────────────────────────────────

export const AI_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

/** Fields appended to every AI output for auto-send eligibility. */
const AutoSendMeta = z.object({
  /** AI self-reported confidence 0.0–1.0. Auto-send requires ≥ 0.90. */
  confidence:      z.number().min(0).max(1).default(0),
  /** "low" | "medium" | "high". Auto-send only allowed on "low". */
  risk_level:      z.enum(["low", "medium", "high"]).default("medium"),
  /** True when the answer is traceable to knowledge base or thread history. */
  source_grounded: z.boolean().default(false),
});

export const AskOutput = z.object({
  action:         z.literal("ask"),
  question:       z.string().min(1),
  collected_info: z.record(z.string(), z.unknown()),
}).merge(AutoSendMeta);

export const SummarizeOutput = z.object({
  action:         z.literal("summarize"),
  case_type:      z.string().min(1),
  summary:        z.string().min(1),
  customer_reply: z.string().min(1),
  collected_info: z.record(z.string(), z.unknown()),
}).merge(AutoSendMeta);

export const EscalateOutput = z.object({
  action: z.literal("escalate"),
  reason: z.string().min(1),
}).merge(AutoSendMeta);

export const AIOutputSchema = z.discriminatedUnion("action", [
  AskOutput,
  SummarizeOutput,
  EscalateOutput,
]);

export type AIOutput = z.infer<typeof AIOutputSchema>;

// ── Anthropic client (lazy-init to avoid missing-key crash at import) ────────

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

// ── Prompt builders ──────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS: Record<AiSettings["tone"], string> = {
  formal:   "Använd ett formellt och professionellt språk.",
  friendly: "Använd ett vänligt och personligt språk.",
  neutral:  "Använd ett neutralt och sakligt språk.",
};

const LANG_NAMES: Record<string, string> = {
  sv: "svenska",
  en: "engelska",
  no: "norska",
  da: "danska",
  fi: "finska",
};

export function buildSystemPrompt(opts: {
  organizationName: string;
  settings: AiSettings;
  caseTypes: CaseType[];
  knowledge?: KnowledgeEntry[];
}): string {
  const { organizationName, settings, caseTypes, knowledge = [] } = opts;

  const caseTypesList = caseTypes.length > 0
    ? caseTypes
        .map(ct => `- "${ct.slug}": ${ct.label}. Required fields: ${(ct.requiredFields ?? []).join(", ") || "none"}`)
        .join("\n")
    : '- "ovrigt": Övrigt. Required fields: none';

  const toneText = TONE_INSTRUCTIONS[settings.tone] ?? TONE_INSTRUCTIONS.neutral;
  const langName = LANG_NAMES[settings.language] ?? settings.language;

  const knowledgeSection = knowledge.length > 0
    ? `\nFÖRETAGSINFORMATION (använd detta för att svara direkt utan att fråga kunden):\n` +
      knowledge.map(k => `- ${k.question}: ${k.answer}`).join("\n")
    : "";

  return `Du är en AI-ärendehanterare för ${organizationName}.
${toneText}
Svara ALLTID på ${langName}.
${knowledgeSection}
DINA ÄRENDETYPER:
${caseTypesList}

REGLER:
1. Identifiera ALLA ämnen i mejlet. Om kunden frågar om flera saker (t.ex. en offert och en separat fråga), adressera båda.
2. Kontrollera vilka required_fields som saknas för den primära ärendetypen.
3. Om något saknas och du är under max ${settings.maxInteractions} interaktioner → ställ EN tydlig fråga (action: ask). Om det finns sidoförfrågningar som du kan besvara direkt, gör det kort i frågan.
4. Om alla required_fields finns → sammanfatta (action: summarize). 
5. Producera "customer_reply" — ett professionellt men personligt bekräftelsemejl. 
   - Om kunden ställt frågor utanför ditt expertområde, förklara artigt att ni inte kan hjälpa till med just det ämnet men besvara det ni kan.
   - Undvik att kännas som en stel autopilot. Var hjälpsam och tydlig med vad företaget kan och inte kan göra.
6. Om ärendetyp är helt oklar ELLER du nått max interaktioner → eskalera (action: escalate).
7. Vid tveksamhet → eskalera hellre än att gissa.

KRITISKT: Returnera ENDAST giltig JSON utan markdown-fences. Inkludera ALLTID dessa tre fält i svaret:
- "confidence": ett tal 0.0–1.0 som representerar hur säker du är på ditt svar
- "risk_level": "low" | "medium" | "high" (eskalering = alltid "high"; klagomål/juridik = "high"; tydlig fråga med känd svar = "low")
- "source_grounded": true om svaret baseras på tillhandahållen företagsinformation eller trådhistorik, annars false

Exakt ett av dessa format:
{"action":"ask","question":"string","collected_info":{},"confidence":0.8,"risk_level":"low","source_grounded":false}
{"action":"summarize","case_type":"string","summary":"string","customer_reply":"string","collected_info":{},"confidence":0.95,"risk_level":"low","source_grounded":true}
{"action":"escalate","reason":"string","confidence":0.0,"risk_level":"high","source_grounded":false}`;
}

export function buildUserMessage(opts: {
  thread: EmailThread;
  messages: EmailMessage[];
  newEmailBody: string;
}): string {
  const { thread, messages, newEmailBody } = opts;

  // Build conversation history. Skip the very last customer message if it's
  // identical to newEmailBody (avoid duplication when caller passes the latest
  // message both as DB row + standalone text).
  const history = messages
    .map(m => {
      const speaker = m.role === "customer"  ? "KUND"
                    : m.role === "assistant" ? "BOT"
                    : "AGENT";
      return `${speaker}: ${m.bodyText ?? ""}`;
    })
    .join("\n\n");

  return `ÄRENDEHISTORIK:
${history || "(inget tidigare)"}

NYTT MEJL FRÅN KUND:
${newEmailBody}

NUVARANDE INTERAKTIONSANTAL: ${thread.interactionCount}
INSAMLAD INFO HITTILLS: ${JSON.stringify(thread.collectedInfo ?? {})}`;
}

// ── Resilience helpers ───────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout efter ${ms}ms`)), ms)
    ),
  ]);
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const message = (err as { message?: string })?.message ?? "";
      const retryable = status === 529 || status === 503 || message.includes("Timeout");
      if (attempt === retries || !retryable) throw err;
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(`[ai] attempt ${attempt}/${retries} failed (${message}); retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── Main entry ───────────────────────────────────────────────────────────────

export type GenerateDraftInput = {
  organizationName: string;
  settings: AiSettings;
  caseTypes: CaseType[];
  knowledge?: KnowledgeEntry[];
  thread: EmailThread;
  messages: EmailMessage[];
  newEmailBody: string;
};

export type GenerateDraftResult = {
  output: AIOutput;
  rawText: string;
  model: string;
};

/**
 * Generate an AI triage decision for one email. Pure function — does not
 * touch the DB. Caller is responsible for persisting the result as an ai_drafts
 * row and incrementing usage counters.
 *
 * On any parse/API failure, returns an `escalate` action with the error reason
 * so the human agent gets a chance to take over.
 */
export async function generateDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const systemPrompt = buildSystemPrompt({
    organizationName: input.organizationName,
    settings:         input.settings,
    caseTypes:        input.caseTypes,
    knowledge:        input.knowledge ?? [],
  });
  const userMessage = buildUserMessage({
    thread:       input.thread,
    messages:     input.messages,
    newEmailBody: input.newEmailBody,
  });

  let rawText = "";

  try {
    const client = getClient();
    // The system prompt is identical across every AI call for the same org
    // (depends only on company name + case_types + tone + language + max_interactions).
    // Marking it cache_control: ephemeral lets Anthropic cache it — 90% discount
    // on cached input tokens + lower latency on the second+ call within the
    // 5-minute TTL window. Saves real money once a customer is processing
    // multiple emails per day.
    const response = await retryWithBackoff(() =>
      withTimeout(
        client.messages.create({
          model:      AI_MODEL,
          max_tokens: 1000,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userMessage }],
        }),
        TIMEOUT_MS
      )
    );

    rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    // Strip any accidental markdown fences
    rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    const parsed = JSON.parse(rawText);
    const validated = AIOutputSchema.parse(parsed);

    return { output: validated, rawText, model: AI_MODEL };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown AI error";
    console.error("[ai] error:", reason, "| raw:", rawText.slice(0, 200));
    return {
      output: {
        action:          "escalate",
        reason:          `AI fallback: ${reason}`,
        confidence:      0,
        risk_level:      "high",
        source_grounded: false,
      },
      rawText,
      model: AI_MODEL,
    };
  }
}
