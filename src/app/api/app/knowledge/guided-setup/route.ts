/**
 * POST /api/app/knowledge/guided-setup
 *
 * Step 1: Takes basic business info, returns AI-generated questions tailored
 *         to that specific business type.
 *
 * Step 2: Takes answered questions, bulk-creates KB entries.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { createKnowledgeEntry } from "@/lib/app/knowledge";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

// ── Step 1: generate questions ────────────────────────────────────────────────

const GenerateBody = z.object({
  action:       z.literal("generate_questions"),
  businessName: z.string().min(1).max(200),
  industry:     z.string().min(1).max(300),
  description:  z.string().min(1).max(1000),
  contactAbout: z.string().max(500).optional(),
  scrapedText:  z.string().max(4000).optional(),
});

// ── Step 2: save answers as KB entries ───────────────────────────────────────

const SaveBody = z.object({
  action:  z.literal("save_answers"),
  entries: z.array(z.object({
    question: z.string().min(1).max(500),
    answer:   z.string().min(1).max(2000),
    category: z.string().max(100).optional(),
  })).min(1).max(30),
});

const Body = z.discriminatedUnion("action", [GenerateBody, SaveBody]);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Not provisioned" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  // ── generate_questions ────────────────────────────────────────────────────
  if (parsed.data.action === "generate_questions") {
    const { businessName, industry, description, contactAbout, scrapedText } = parsed.data;

    const prompt = `Du hjälper "${businessName}" att sätta upp en kunskapsbas för deras AI-baserade kundtjänst.

INFORMATION OM FÖRETAGET:
- Bransch: ${industry}
- Vad de gör: ${description}
${contactAbout ? `- Vad kunder vanligtvis kontaktar dem om: ${contactAbout}` : ""}
${scrapedText ? `\nINNEHÅLL FRÅN DERAS HEMSIDA:\n${scrapedText}` : ""}

Din uppgift: Generera 8–12 konkreta frågor som deras kunder TROLIGEN ställer via mail, och som företaget borde ha färdiga svar på i sin kunskapsbas.

Regler:
- Frågorna ska vara specifika för DENNA bransch och verksamhetstyp
- Täck in: priser/prisintervall, tjänster, geografiskt område, ledtider, vad de inte gör, betalning, garantier, kontakt
- Formulera frågorna som kunder faktiskt skriver dem
- Kategorisera varje fråga (t.ex. "Priser", "Tjänster", "Område", "Process", "Övrigt")

Returnera ENDAST giltig JSON, ingen annan text:
{
  "questions": [
    { "question": "Vad kostar det att renovera ett badrum?", "category": "Priser", "hint": "Ange prisintervall eller hur ni prissätter (fast pris, löpande räkning, per kvm etc.)" },
    ...
  ]
}`;

    try {
      const response = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages:   [{ role: "user", content: prompt }],
      });

      let raw = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      const data = JSON.parse(raw) as { questions: { question: string; category: string; hint: string }[] };
      return NextResponse.json({ questions: data.questions });
    } catch (err) {
      console.error("[guided-setup] generate failed:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }
  }

  // ── save_answers ──────────────────────────────────────────────────────────
  const { entries } = parsed.data;
  const saved = await Promise.all(
    entries
      .filter(e => e.answer.trim().length > 0)
      .map(e =>
        createKnowledgeEntry({
          organizationId: account.organization.id,
          question:       e.question,
          answer:         e.answer.trim(),
          category:       e.category,
        })
      )
  );

  return NextResponse.json({ saved: saved.length });
}
