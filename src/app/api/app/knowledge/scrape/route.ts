/**
 * POST /api/app/knowledge/scrape
 *
 * Fetches a URL, extracts text, asks Claude to identify FAQ/pricing entries,
 * and bulk-inserts them as knowledge entries for the org.
 *
 * Body: { url: string }
 * Returns: { inserted: number, entries: { question, answer }[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { bulkCreateKnowledge } from "@/lib/app/knowledge";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  url: z.string().url(),
});

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mailmind-Onboarding-Bot/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const html = await res.text();

  // Strip HTML tags, scripts, styles — keep text
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{3,}/g, "\n")
    .slice(0, 8000); // cap to avoid huge prompts
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user) return NextResponse.json({ error: "Not provisioned" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });

  const { url } = parsed.data;

  // Fetch page
  let pageText: string;
  try {
    pageText = await fetchPageText(url);
  } catch (e) {
    return NextResponse.json({
      error: `Could not fetch ${url}: ${e instanceof Error ? e.message : "unknown error"}`,
    }, { status: 422 });
  }

  if (!pageText.trim()) {
    return NextResponse.json({ error: "Page appears empty" }, { status: 422 });
  }

  // Ask Claude to extract FAQ + pricing
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: `Du extraherar FAQ och prisinformation från hemsidetext.
Returnera ENDAST giltig JSON-array utan markdown:
[{"question":"...","answer":"...","category":"pricing|contact|hours|faq|policy|other"}]
Max 15 poster. Frågor och svar på samma språk som sidan. Inkludera bara konkret faktainformation.`,
    messages: [{
      role: "user",
      content: `Hemsida: ${url}\n\nText:\n${pageText}\n\nExtrahera FAQ och prisinformation som JSON-array.`,
    }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let entries: { question: string; answer: string; category?: string }[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed.filter(
        e => typeof e.question === "string" && typeof e.answer === "string"
      );
    }
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ inserted: 0, entries: [], message: "No extractable info found on page" });
  }

  const inserted = await bulkCreateKnowledge(account.organization.id, entries);

  return NextResponse.json({ inserted, entries });
}
