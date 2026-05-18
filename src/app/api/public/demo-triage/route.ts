/**
 * /api/public/demo-triage
 *
 * Public endpoint — no auth required.
 *   GET  — returns the list of demo examples
 *   POST — runs AI triage on a chosen example
 *
 * Security:
 *   - Rate-limited: 10 req/min per IP (in-memory token bucket)
 *   - 24h result cache per exampleId (cuts API cost to near-zero)
 *   - Uses DEMO_ANTHROPIC_API_KEY if set, falls back to ANTHROPIC_API_KEY
 *   - Input is fully hardcoded — no user content reaches the prompt
 *   - Returns JSON only, no execution of user input
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildSystemPrompt,
  buildUserMessage,
  AIOutputSchema,
  AI_MODEL,
} from "@/lib/app/ai";
import type {
  AIOutput,
  AISource,
} from "@/lib/app/ai";
import type { AiSettings, CaseType, EmailThread, EmailMessage } from "@/lib/db/schema";

export const runtime = "nodejs";

// ── Demo company — Acme El & VVS AB ──────────────────────────────────────────

const DEMO_ORG = "Acme El & VVS AB";

const DEMO_KNOWLEDGE = [
  {
    id:       "demo-kb-0001",
    question: "Öppettider",
    answer:   "Måndag–fredag 07:00–17:00. Lördagar 09:00–14:00 (gäller maj–aug). Söndagar stängt.",
  },
  {
    id:       "demo-kb-0002",
    question: "Offertprocess",
    answer:   "Vi erbjuder kostnadsfria offertbesök inom 5 arbetsdagar. Boka via 08-123 45 67 eller info@acme-elvvs.se.",
  },
  {
    id:       "demo-kb-0003",
    question: "Garanti",
    answer:   "Alla utförda arbeten har 2 års garanti. Reklamationer hanteras inom 48 timmar.",
  },
  {
    id:       "demo-kb-0004",
    question: "Reklamationsprocess",
    answer:   "Kontakta oss via reklamation@acme-elvvs.se eller ring 08-123 45 67. Vi bokar ett återbesök inom 48 timmar och åtgärdar utan kostnad om felet beror på vår installation.",
  },
  {
    id:       "demo-kb-0005",
    question: "Tjänster vi erbjuder",
    answer:   "El-installationer, VVS-arbeten, värmepumpsservice och badrumsrenovering i Stockholm och Mälarregionen.",
  },
  {
    id:       "demo-kb-0006",
    question: "Betalningsalternativ",
    answer:   "Faktura med 30 dagars betalningsvillkor, kort och Swish. ROT-avdrag tillämpas på arbete.",
  },
  {
    id:       "demo-kb-0007",
    question: "Jour och akuta ärenden",
    answer:   "Jourtjänst dygnet runt för akuta el- och VVS-fel. Jourtelefon: 08-123 45 99.",
  },
  {
    id:       "demo-kb-0008",
    question: "Certifieringar",
    answer:   "Auktoriserad el-installatör (ELSÄK) och Säker Vatten-certifierad VVS-firma.",
  },
];

const DEMO_CASE_TYPES: CaseType[] = [
  {
    id: "demo-ct-1", organizationId: "demo", slug: "offert",
    label: "Offertförfrågan", requiredFields: ["adress", "typ_av_arbete"],
    isDefault: false, sortOrder: 1, routeToEmail: null, slaHours: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "demo-ct-2", organizationId: "demo", slug: "reklamation",
    label: "Reklamation", requiredFields: ["beskrivning_av_felet"],
    isDefault: false, sortOrder: 2, routeToEmail: null, slaHours: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "demo-ct-3", organizationId: "demo", slug: "fragor",
    label: "Allmänna frågor", requiredFields: [],
    isDefault: false, sortOrder: 3, routeToEmail: null, slaHours: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: "demo-ct-4", organizationId: "demo", slug: "ovrigt",
    label: "Övrigt", requiredFields: [],
    isDefault: true, sortOrder: 99, routeToEmail: null, slaHours: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
];

const DEMO_SETTINGS: AiSettings = {
  id: "demo-settings", organizationId: "demo",
  tone: "friendly", language: "sv", maxInteractions: 3,
  signature: null, dryRunEnabled: false, autoSendEnabled: false,
  bulkFilterEnabled: true, bulkFilterWhitelist: [],
  createdAt: new Date(), updatedAt: new Date(),
};

// ── Example emails ────────────────────────────────────────────────────────────

export type ExampleId = "offert" | "reklamation" | "oppettider";

export type DemoExample = {
  id:          ExampleId;
  label:       string;
  description: string;
  icon:        string;
  from:        string;
  subject:     string;
  body:        string;
};

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    id:          "offert",
    label:       "Offertförfrågan",
    description: "Kund vill ha pris på el-installation",
    icon:        "⚡",
    from:        "Anna Berg <anna.berg@gmail.com>",
    subject:     "Offert på uppgradering av elpanel",
    body:        "Hej!\n\nJag undrar om ni kan hjälpa mig med att byta ut elpanelen i min villa (150 kvm, byggd 1978) i Täby. Elinstallatören som kom hem till mig för att titta på en annan sak sa att jag borde uppgradera den.\n\nKan ni ge en offert på vad det skulle kosta?\n\nMvh\nAnna Berg",
  },
  {
    id:          "reklamation",
    label:       "Reklamation",
    description: "Missnöjd kund kräver åtgärd på utfört arbete",
    icon:        "🔧",
    from:        "Erik Lindström <e.lindstrom@outlook.com>",
    subject:     "Reklamation – värmepump slutade fungera igen",
    body:        "Hej,\n\nJag är väldigt missnöjd. Ni lagade min värmepump den 12 maj men den slutade fungera redan efter 2 dagar. Det är helt oacceptabelt.\n\nJag kräver att ni åtgärdar detta omgående och utan extra kostnad. Vad gäller egentligen för garanti hos er?\n\nErik Lindström",
  },
  {
    id:          "oppettider",
    label:       "Fråga om öppettider",
    description: "Kund undrar om ni har öppet på helgen",
    icon:        "🕐",
    from:        "Karin Svensson <karin.s@hotmail.se>",
    subject:     "Öppettider på lördagar?",
    body:        "Hej!\n\nJag undrar om ni har öppet på lördagar? Jag behöver råd kring ett VVS-problem i mitt badrum och skulle vilja komma in och prata med någon i butiken. Kan man boka en tid?\n\nMed vänliga hälsningar\nKarin Svensson",
  },
];

// ── 24h in-memory result cache ────────────────────────────────────────────────

type CacheEntry = { result: DemoTriageResult; cachedAt: number };
const RESULT_CACHE = new Map<ExampleId, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCached(id: ExampleId): (DemoTriageResult & { fromCache: true }) | null {
  const entry = RESULT_CACHE.get(id);
  if (!entry || Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    RESULT_CACHE.delete(id);
    return null;
  }
  return { ...entry.result, fromCache: true };
}

// ── Anthropic client ──────────────────────────────────────────────────────────

function getDemoClient(): Anthropic {
  // DEMO_ANTHROPIC_API_KEY allows a separate quota-capped key for the public demo.
  // Falls back to the main key — cached results mean this is rarely called.
  const key = process.env.DEMO_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No Anthropic API key configured");
  return new Anthropic({ apiKey: key });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DemoTriageResult = {
  action:     AIOutput["action"];
  draft:      string | null;
  confidence: number;
  caseType:   string | null;
  sources:    AISource[];
  fromCache?: boolean;
  /** Current AI turn number (1 = initial, 2 = response to user follow-up). */
  turn?:      number;
  /** Hard cap on AI turns in the demo. After this, client gates with upgrade CTA. */
  maxTurns?:  number;
  /** True when no more user replies are allowed — UI should show upgrade CTA. */
  blocked?:   boolean;
};

/** One past turn in the demo conversation. */
export type DemoHistoryEntry = {
  role: "customer" | "assistant";
  body: string;
};

/** Hard limit on the number of AI calls per demo conversation. */
const DEMO_MAX_TURNS = 2;

// ── Core triage runner ────────────────────────────────────────────────────────

async function runDemoTriage(
  example:    DemoExample,
  history:    DemoHistoryEntry[] = [],
  userReply?: string,
): Promise<DemoTriageResult> {
  const isFollowUp = history.length > 0 && !!userReply;

  // Cache only the FIRST turn (initial example). Follow-ups are unique.
  if (!isFollowUp) {
    const cached = getCached(example.id);
    if (cached) return { ...cached, turn: 1, maxTurns: DEMO_MAX_TURNS, blocked: false };
  }

  const now = new Date();
  const senderEmail = example.from.match(/<(.+)>/)?.[1] ?? example.from;
  const senderName  = example.from.split("<")[0].trim();

  // Minimal mock objects — only the fields used by buildUserMessage/buildSystemPrompt
  const mockThread = {
    id:               `demo-thread-${example.id}`,
    organizationId:   "demo",
    subject:          example.subject,
    fromEmail:        senderEmail,
    fromName:         senderName,
    status:           "open",
    interactionCount: Math.floor(history.length / 2),
    collectedInfo:    {},
    createdAt:        now,
    updatedAt:        now,
    resolvedAt:       null,
    snoozedUntil:     null,
    inboxId:          null,
    caseTypeSlug:     null,
    lastMessageAt:    now,
    assignedTo:       null,
  } as unknown as EmailThread;

  // Replay full conversation history as mock messages, then append the latest
  // customer message (either the example body, or the user's follow-up reply).
  const mockMessages: EmailMessage[] = [];
  // Initial customer email
  mockMessages.push({
    id:             `demo-msg-${example.id}-0`,
    threadId:       `demo-thread-${example.id}`,
    organizationId: "demo",
    role:           "customer",
    bodyText:       example.body,
    subject:        example.subject,
    fromEmail:      senderEmail,
    fromName:       senderName,
    createdAt:      now,
    updatedAt:      now,
  } as unknown as EmailMessage);
  // Replay history (skipping the very first customer message which we already added)
  history.slice(1).forEach((entry, i) => {
    mockMessages.push({
      id:             `demo-msg-${example.id}-${i + 1}`,
      threadId:       `demo-thread-${example.id}`,
      organizationId: "demo",
      role:           entry.role,
      bodyText:       entry.body,
      subject:        example.subject,
      fromEmail:      entry.role === "customer" ? senderEmail : null,
      fromName:       entry.role === "customer" ? senderName  : null,
      createdAt:      now,
      updatedAt:      now,
    } as unknown as EmailMessage);
  });

  // The newest message we want AI to act on
  const newEmailBody = userReply ?? example.body;

  const systemPrompt = buildSystemPrompt({
    organizationName: DEMO_ORG,
    settings:         DEMO_SETTINGS,
    caseTypes:        DEMO_CASE_TYPES,
    knowledge:        DEMO_KNOWLEDGE as Parameters<typeof buildSystemPrompt>[0]["knowledge"],
  });

  const userMessage = buildUserMessage({
    thread:       mockThread,
    messages:     mockMessages,
    newEmailBody,
  });

  const client = getDemoClient();
  const response = await client.messages.create({
    model:      AI_MODEL,
    max_tokens: 1000,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });

  let rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");
  rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  let output: AIOutput;
  try {
    output = AIOutputSchema.parse(JSON.parse(rawText));
  } catch {
    output = {
      action: "escalate", reason: "Demo parse error",
      confidence: 0, risk_level: "high", source_grounded: false, sources: [],
    };
  }

  // Compute draft text
  const draft =
      output.action === "summarize" ? output.customer_reply
    : output.action === "ask"       ? output.question
    : output.action === "ignore"    ? `(AI bedömde att detta var ett auto-genererat mejl: ${output.reason})`
    : null; // escalate

  const turnNumber = isFollowUp ? 2 : 1;

  const result: DemoTriageResult = {
    action:     output.action,
    draft,
    confidence: output.confidence,
    caseType:   output.action === "summarize" ? output.case_type : null,
    sources:    output.sources,
    turn:       turnNumber,
    maxTurns:   DEMO_MAX_TURNS,
    blocked:    turnNumber >= DEMO_MAX_TURNS,
  };

  // Cache only the first-turn (deterministic) result. Follow-ups depend on
  // user input and shouldn't be replayed for other visitors.
  if (!isFollowUp) {
    RESULT_CACHE.set(example.id, { result, cachedAt: Date.now() });
  }
  return result;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    examples: DEMO_EXAMPLES.map(({ id, label, description, icon, from, subject, body }) => ({
      id, label, description, icon, from, subject, body,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!rateLimit(`demo:${ip}`, { capacity: 10, refillPerSec: 10 / 60 })) {
    return NextResponse.json(
      { error: "För många förfrågningar. Vänta en stund och försök igen." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const json = await req.json().catch(() => null);
  const exampleId = json?.exampleId as ExampleId | undefined;
  const example   = DEMO_EXAMPLES.find(e => e.id === exampleId);

  if (!example) {
    return NextResponse.json({ error: "Ogiltigt exempelID" }, { status: 400 });
  }

  // Validate optional follow-up payload
  const rawHistory: unknown = json?.history;
  const userReply: string | undefined = typeof json?.userReply === "string" && json.userReply.trim().length > 0
    ? json.userReply.trim().slice(0, 2000)   // hard-cap to avoid prompt abuse
    : undefined;

  let history: DemoHistoryEntry[] = [];
  if (Array.isArray(rawHistory)) {
    history = rawHistory
      .filter((h): h is DemoHistoryEntry =>
        h && typeof h === "object"
        && (h.role === "customer" || h.role === "assistant")
        && typeof h.body === "string"
      )
      .slice(0, 6); // safety: cap replay length
  }

  // Server-side enforcement of max turns — don't let a manipulated client
  // bypass the limit by faking a short history.
  const customerRepliesInHistory = history.filter(h => h.role === "customer").length;
  // history always starts with the example body (1 customer message), so a real
  // follow-up means customerReplies >= 2.
  if (userReply && customerRepliesInHistory >= DEMO_MAX_TURNS) {
    return NextResponse.json({
      error: "Demo-gränsen nådd. Skapa ett konto för att fortsätta testa AI:n med dina egna mejl.",
      blocked: true,
    }, { status: 402 });
  }

  try {
    const result = await runDemoTriage(example, history, userReply);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[demo-triage]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "AI-tjänsten är tillfälligt otillgänglig. Försök igen om ett ögonblick." },
      { status: 503 },
    );
  }
}
