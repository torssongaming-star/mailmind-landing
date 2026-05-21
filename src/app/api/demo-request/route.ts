import { Resend } from "resend";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { maskEmail } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

// ── Validation Schema ────────────────────────────────────────────────────────
// Strict max-lengths stop a hostile client from posting megabytes of HTML.
const demoRequestSchema = z.object({
  fullName:       z.string().min(2).max(120),
  workEmail:      z.string().email().max(320),
  companyName:    z.string().min(1).max(200),
  companyWebsite: z.string().max(500).optional(),
  emailVolume:    z.string().min(1).max(50),
  currentSystem:  z.string().min(1).max(100),
  message:        z.string().max(5000).optional(),
  // Honeypot field — should be empty
  websiteUrl:     z.string().optional(),
});

/** HTML entity escape — keep ALL user input safe inside the email template. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
/**
 * POST /api/demo-request
 *
 * Receives demo requests from the contact form and sends them via Resend.
 * Includes a honeypot field 'websiteUrl' to prevent spam.
 */
export async function POST(req: NextRequest) {
  try {
    // 0. Rate-limit per IP — 5 requests / 10 min. Stops Resend-spam and
    //    honeypot bypasses without needing CAPTCHA in the MVP.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    if (!(await rateLimit(`demo-request:${ip}`, { capacity: 5, refillPerSec: 5 / 600 }))) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en stund." },
        { status: 429 },
      );
    }

    const body = await req.json();

    // 1. Validate with Zod
    const result = demoRequestSchema.safeParse(body);
    if (!result.success) {
      console.warn("[api/demo-request] Validation failed:", result.error.format());
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    // 2. Honeypot check
    // If 'websiteUrl' is filled, it's likely a bot. Silently return success.
    if (data.websiteUrl) {
      console.warn("[api/demo-request] Honeypot triggered by:", maskEmail(data.workEmail));
      return NextResponse.json({ success: true });
    }
    // 3. Check environment variables
    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.DEMO_REQUEST_TO;
    const fromEmail = process.env.DEMO_REQUEST_FROM;

    if (!apiKey || !toEmail || !fromEmail) {
      // Don't leak which env var is missing — that's a config-disclosure
      // gift to an attacker. Log internally, return a generic message.
      const missing = [
        apiKey    ? null : "RESEND_API_KEY",
        toEmail   ? null : "DEMO_REQUEST_TO",
        fromEmail ? null : "DEMO_REQUEST_FROM",
      ].filter(Boolean).join(", ");
      console.error("[api/demo-request] Missing env vars:", missing);
      return NextResponse.json(
        { error: "Tjänsten är tillfälligt otillgänglig. Försök igen senare." },
        { status: 500 },
      );
    }

    // 4. Send email — every interpolated field is escaped to prevent the
    //    attacker turning the internal demo email into a phishing template
    //    (img/script injection, fake CTAs, etc.).
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:    fromEmail,
      to:      toEmail,
      subject: `New Demo Request: ${data.companyName.slice(0, 80)}`,
      replyTo: data.workEmail,
      html: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.workEmail)}</p>
        <p><strong>Company:</strong> ${escapeHtml(data.companyName)}</p>
        <p><strong>Website:</strong> ${escapeHtml(data.companyWebsite || "Not provided")}</p>
        <p><strong>Email Volume:</strong> ${escapeHtml(data.emailVolume)}</p>
        <p><strong>Current System:</strong> ${escapeHtml(data.currentSystem)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(data.message || "No message provided")}</p>
        <hr />
        <p><small>This request was sent from the ${escapeHtml(siteConfig.siteName)} landing page form.</small></p>
      `,
    });

    if (error) {
      // Don't echo Resend's error message back to a public caller — log it.
      console.error("[api/demo-request] Resend API error:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: "Tjänsten är tillfälligt otillgänglig. Försök igen senare." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/demo-request] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
