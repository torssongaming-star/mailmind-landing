import { Resend } from "resend";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { siteConfig } from "@/config/site";

// ── Validation Schema ────────────────────────────────────────────────────────
const demoRequestSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  workEmail: z.string().email("Invalid work email address"),
  companyName: z.string().min(1, "Company name is required"),
  companyWebsite: z.string().optional(),
  emailVolume: z.string().min(1, "Email volume is required"),
  currentSystem: z.string().min(1, "Current system is required"),
  message: z.string().optional(),
  // Honeypot field — should be empty
  websiteUrl: z.string().optional(),
});
/**
 * POST /api/demo-request
 *
 * Receives demo requests from the contact form and sends them via Resend.
 * Includes a honeypot field 'websiteUrl' to prevent spam.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[api/demo-request] Received body:", JSON.stringify(body, null, 2));

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
      console.warn("[api/demo-request] Honeypot triggered by:", data.workEmail);
      return NextResponse.json({ success: true });
    }
    // 3. Check environment variables
    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.DEMO_REQUEST_TO;
    const fromEmail = process.env.DEMO_REQUEST_FROM;

    if (!apiKey || !toEmail || !fromEmail) {
      const missing = [];
      if (!apiKey) missing.push("RESEND_API_KEY");
      if (!toEmail) missing.push("DEMO_REQUEST_TO");
      if (!fromEmail) missing.push("DEMO_REQUEST_FROM");
      console.error("[api/demo-request] Missing environment variables:", missing.join(", "));
      return NextResponse.json(
        { error: `Email service not configured. Missing: ${missing.join(", ")}` },
        { status: 500 }
      );
    }

    // 4. Send email
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `New Demo Request: ${data.companyName}`,
      replyTo: data.workEmail,
      html: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${data.fullName}</p>
        <p><strong>Email:</strong> ${data.workEmail}</p>
        <p><strong>Company:</strong> ${data.companyName}</p>
        <p><strong>Website:</strong> ${data.companyWebsite || "Not provided"}</p>
        <p><strong>Email Volume:</strong> ${data.emailVolume}</p>
        <p><strong>Current System:</strong> ${data.currentSystem}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message || "No message provided"}</p>
        <hr />
        <p><small>This request was sent from the ${siteConfig.siteName} landing page form.</small></p>
      `,
    });

    if (error) {
      console.error("[api/demo-request] Resend API error:", JSON.stringify(error, null, 2));
      return NextResponse.json({ error: `Email service error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/demo-request] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
