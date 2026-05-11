/**
 * POST /api/app/support
 *
 * Sends a support message from the logged-in user to support@mailmind.se.
 * Rate-limited to 3 messages per hour per org via a simple in-memory map
 * (good enough for MVP — replace with Redis if load requires it).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { sendEmail } from "@/lib/app/email";

export const runtime = "nodejs";

// Simple in-memory rate limit: orgId → [timestamps]
const recentRequests = new Map<string, number[]>();
const RATE_LIMIT  = 3;
const WINDOW_MS   = 60 * 60 * 1_000; // 1 hour

function isRateLimited(key: string): boolean {
  const now  = Date.now();
  const prev = (recentRequests.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (prev.length >= RATE_LIMIT) return true;
  recentRequests.set(key, [...prev, now]);
  return false;
}

const Body = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5_000),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  if (isRateLimited(account.organization.id)) {
    return NextResponse.json(
      { error: "För många meddelanden. Försök igen om en timme." },
      { status: 429 }
    );
  }

  const json   = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltigt formulär" }, { status: 400 });
  }

  const { subject, message } = parsed.data;
  const fromEmail = account.user.email;
  const orgName   = account.organization.name;

  const result = await sendEmail({
    to:      "support@mailmind.se",
    subject: `[Support] ${subject}`,
    text: [
      `Från: ${fromEmail}`,
      `Organisation: ${orgName} (${account.organization.id})`,
      "",
      message,
    ].join("\n"),
    replyTo: fromEmail,
  });

  if (!result.ok) {
    console.error("[support] sendEmail failed:", result.error);
    return NextResponse.json({ error: "Kunde inte skicka meddelandet." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
