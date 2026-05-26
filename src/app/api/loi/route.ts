/**
 * POST /api/loi — registrera en avsiktsförklaring (Letter of Intent).
 *
 * Inte juridiskt bindande — bara en daterad viljeyttring. Pre-AB-lösning
 * för social proof. Lagras i pre_launch_intents.
 *
 * Flöde:
 *   1. Validera body (Zod)
 *   2. Rate limit per IP (5 signaturer/h — anti-spam)
 *   3. Generera intentText från delad helper (måste matcha UI:ts visning)
 *   4. Spara via signLoi() — upsert på (email, company)
 *   5. Skicka bekräftelsemejl med verifieringslänk (best-effort)
 *   6. Returnera { ok: true, signedAt }
 *
 * Säkerhet:
 *   - Honeypot-fält "website" rejectas tyst (dropdown av bots)
 *   - IP + User-Agent loggas som signaturbevis
 *   - Mejladress lowercas vid lagring (normaliserad nyckel)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signLoi } from "@/lib/loi/queries";
import { sendLoiConfirmation } from "@/lib/loi/email";
import { generateIntentText } from "@/lib/loi/intent-text";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  name:        z.string().trim().min(2).max(255),
  email:       z.string().trim().toLowerCase().email().max(320),
  company:     z.string().trim().min(2).max(255),
  role:        z.string().trim().max(100).optional().nullable(),
  companySize: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional().nullable(),
  phone:       z.string().trim().max(64).optional().nullable(),
  /** Honeypot — riktiga användare lämnar tomt. */
  website:     z.string().optional(),
  /** Krav på checkbox-godkännande. */
  acceptedAt:  z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0].trim())
          ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;

  // Honeypot-bot-skydd — om "website" är ifyllt är det troligen en bot.
  // Returnera 200 OK så boten tror den lyckades, men gör inget.
  // Validera body först så vi kan läsa fältet.
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true, signedAt: new Date().toISOString() });
  }

  // Rate limit per IP (5 signaturer/timme). Pass-through om Redis saknas.
  const allowed = await rateLimit(`loi:${ip}`, { capacity: 5, refillPerSec: 5 / 3600 });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "För många försök från din IP. Försök igen om en stund." },
      { status: 429 },
    );
  }

  const intentText = generateIntentText({
    name:    parsed.data.name,
    company: parsed.data.company,
  });

  const result = await signLoi({
    name:        parsed.data.name,
    email:       parsed.data.email,
    company:     parsed.data.company,
    role:        parsed.data.role        ?? null,
    companySize: parsed.data.companySize ?? null,
    phone:       parsed.data.phone       ?? null,
    intentText,
    ipAddress:   ip,
    userAgent,
  });

  if (!result.ok) {
    console.error("[api/loi] signLoi failed:", result.error);
    return NextResponse.json(
      { error: "store_failed" },
      { status: 500 },
    );
  }

  // Bekräftelsemejl — best-effort, blockerar inte 200 OK om Resend failar.
  // Användaren har en signerad DB-rad även om mejlet inte gick fram.
  void sendLoiConfirmation({ intent: result.intent }).catch(err =>
    console.error("[api/loi] confirmation send failed (non-fatal):", err),
  );

  return NextResponse.json({
    ok:       true,
    signedAt: result.intent.signedAt.toISOString(),
    isNew:    result.isNew,
  });
}
