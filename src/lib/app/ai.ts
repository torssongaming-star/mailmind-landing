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
import type { CustomerHistorySummary } from "./threads";

// ── Public types ──────────────────────────────────────────────────────────────

export const AI_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 15_000;

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

  const hasKnowledge = knowledge.length > 0;
  const knowledgeSection = hasKnowledge
    ? `\nFÖRETAGSINFORMATION (det enda du får hänvisa till när du svarar kunden):\n` +
      knowledge.map(k => `- ${k.question}: ${k.answer}`).join("\n")
    : "\n(Ingen företagsinformation är inlagd ännu.)";

  return `Du är en AI-ärendehanterare för ${organizationName}.
${toneText}
Svara ALLTID på ${langName}.
${knowledgeSection}

DINA ÄRENDETYPER:
${caseTypesList}

ABSOLUTA BEGRÄNSNINGAR — bryt aldrig mot dessa:
A. Du får ALDRIG uppskatta, räkna ut eller gissa priser, kostnader, tidsåtgång, materialåtgång eller andra specifika siffror om de inte finns ordagrant i FÖRETAGSINFORMATION ovan.
B. "source_grounded: true" får BARA sättas om svaret är direkt hämtat från FÖRETAGSINFORMATION eller trådhistoriken — aldrig från din inbyggda kunskap.
C. Skriv ALDRIG en offert, kalkyl eller prisuppskattning. Det är säljarens uppgift, inte din.

BESLUTSFLÖDE:
1. Identifiera ärendetyp och vilka required_fields som saknas.
2. Om required_fields saknas och du är under max ${settings.maxInteractions} interaktioner → action: ask.
   - Ställ EN fokuserad följdfråga per runda. Bekräfta det kunden redan sagt.
   - Fråga det MEST kritiska som saknas — gå från grovt till detaljerat.
3. När ALLA required_fields är insamlade, avgör:
   a. Om FÖRETAGSINFORMATION täcker svaret fullt ut → action: summarize med customer_reply som besvarar kunden.
   b. Om svaret kräver information som SAKNAS i FÖRETAGSINFORMATION (t.ex. prissättning, tillgänglighet, specifika produkter) → action: escalate med en intern sammanfattning av vad kunden behöver, så att en människa kan ta över och svara.
4. Om ärendetypen är helt oklar ELLER du nått max ${settings.maxInteractions} interaktioner → action: escalate.
5. Vid minsta tveksamhet → eskalera hellre än att gissa eller uppfinna information.

FORMAT — returnera ENDAST giltig JSON utan markdown. Välj EXAKT ett av:
{"action":"ask","question":"<fråga till kunden>","collected_info":{},"confidence":0.8,"risk_level":"low","source_grounded":false}
{"action":"summarize","case_type":"<slug>","summary":"<intern sammanfattning>","customer_reply":"<mejl till kunden>","collected_info":{},"confidence":0.95,"risk_level":"low","source_grounded":true}
{"action":"escalate","reason":"<intern beskrivning av vad kunden behöver — skriv som en briefing till säljaren>","confidence":0.0,"risk_level":"high","source_grounded":false}

Fälten confidence, risk_level och source_grounded är obligatoriska i alla svar.`;
}

export function buildUserMessage(opts: {
  thread: EmailThread;
  messages: EmailMessage[];
  newEmailBody: string;
  customerHistory?: CustomerHistorySummary;
}): string {
  const { thread, messages, newEmailBody, customerHistory } = opts;

  const history = messages
    .map(m => {
      const speaker = m.role === "customer"  ? "KUND"
                    : m.role === "assistant" ? "BOT"
                    : "AGENT";
      return `${speaker}: ${m.bodyText ?? ""}`;
    })
    .join("\n\n");

  // Customer context — only emitted when there are past threads from this email.
  // Goal: give the AI signal that this is a returning customer + what their
  // past concerns were, without bloating the prompt.
  let customerContext = "";
  if (customerHistory && customerHistory.threads.length > 0) {
    const pastLines = customerHistory.threads.map(t => {
      const date = t.lastMessageAt
        ? t.lastMessageAt.toISOString().slice(0, 10)
        : "okänt datum";
      const subj = t.subject ?? "(inget ämne)";
      const cat  = t.caseTypeSlug ? ` [${t.caseTypeSlug}]` : "";
      return `- ${date}: "${subj}"${cat} — status: ${t.status}`;
    }).join("\n");

    customerContext = `\nKUNDHISTORIK (tidigare ärenden från samma e-postadress):
Antal tidigare ärenden: ${customerHistory.pastThreadCount}
${pastLines}

Anpassa tonen mot återkommande kunder. Hänvisa till tidigare ärenden om relevant.
`;
  }

  return `${customerContext}ÄRENDEHISTORIK:
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

export class AiTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiTransientError";
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { maxRetries: number; delays: number[] }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const error = err as {
        status?: number;
        message?: string;
        headers?: Record<string, string>;
      };
      const status = error.status;
      const message = error.message ?? "";

      // Retry on: status >= 500, ETIMEDOUT, ECONNRESET, Timeout
      const isTransient =
        (status && status >= 500) ||
        message.includes("ETIMEDOUT") ||
        message.includes("ECONNRESET") ||
        message.includes("Timeout");

      const isRateLimit = status === 429;

      if (!isTransient && !isRateLimit) {
        throw err; // Not retryable (e.g. 400, 401)
      }

      if (attempt === opts.maxRetries) {
        throw new AiTransientError(message);
      }

      let wait = opts.delays[attempt] ?? 1000;
      if (isRateLimit) {
        const retryAfter = error.headers?.["retry-after"];
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed)) wait = parsed * 1000;
        }
      }

      console.warn(
        `[ai] attempt ${attempt + 1}/${opts.maxRetries + 1} failed (${message}); retrying in ${wait}ms`
      );
      await new Promise((r) => setTimeout(r, wait));
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
  /** Past threads from same customer — optional, injected into prompt when present. */
  customerHistory?: CustomerHistorySummary;
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
    thread:          input.thread,
    messages:        input.messages,
    newEmailBody:    input.newEmailBody,
    customerHistory: input.customerHistory,
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
    const response = await retryWithBackoff(
      () =>
        withTimeout(
          client.messages.create({
            model: AI_MODEL,
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
        ),
      { maxRetries: 2, delays: [500, 1500] }
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
    if (err instanceof AiTransientError) {
      throw err;
    }
    const reason = err instanceof Error ? err.message : "Unknown AI error";
    console.error("[ai] error:", reason, "| raw:", rawText.slice(0, 200));
    return {
      output: {
        action: "escalate",
        reason: `AI fallback: ${reason}`,
        confidence: 0,
        risk_level: "high",
        source_grounded: false,
      },
      rawText,
      model: AI_MODEL,
    };
  }
}
