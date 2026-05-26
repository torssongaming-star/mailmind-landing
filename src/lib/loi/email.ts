/**
 * Letter of Intent — bekräftelsemejl + verifieringslänk.
 *
 * Skickas direkt efter att en användare har klickat "Skriv på" på /loi.
 * Mejlet innehåller:
 *   - Bekräftelse på att vi mottagit avsiktsförklaringen
 *   - Den exakta texten användaren godkände (bevishållning på kundens sida)
 *   - Tidsstämpel + företagsuppgifter
 *   - En verifieringslänk som bekräftar att mejladressen är giltig
 *   - Notering att detta inte är juridiskt bindande
 *
 * Använder samma Resend-klient som /lib/app/email.ts — ingen ny dep.
 *
 * Säkerhet:
 *   - Verifieringstoken är random 32-byte hex (single-use)
 *   - Länk är https://mailmind.se/api/loi/verify?token=<token>
 *   - Token raderas (sätts till null) när den klickas
 */

import type { PreLaunchIntent } from "@/lib/db";

const FROM_DEFAULT = "Mailmind <hello@mailmind.se>";

function getFromAddress(): string {
  return process.env.MAILMIND_LOI_FROM_EMAIL
      ?? process.env.MAILMIND_FROM_EMAIL
      ?? FROM_DEFAULT;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
}

export type LoiConfirmationParams = {
  intent: Pick<PreLaunchIntent,
    "name" | "email" | "company" | "role" | "companySize"
    | "intentText" | "signedAt" | "verificationToken"
  >;
};

/**
 * Skickar bekräftelsemejl till företaget som just har skrivit på.
 * Best-effort — kastar bara om Resend själv kraschar.
 */
export async function sendLoiConfirmation(
  params: LoiConfirmationParams,
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { intent } = params;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[loi/email] RESEND_API_KEY not set — skipping confirmation send");
    return { ok: false, error: "resend_not_configured" };
  }

  const verifyUrl =
    intent.verificationToken
      ? `${getBaseUrl()}/api/loi/verify?token=${intent.verificationToken}`
      : null;

  const html = renderHtml({ intent, verifyUrl });
  const text = renderText({ intent, verifyUrl });

  try {
    // Late-load Resend för att hålla cold-start nere på routes som inte
    // skickar LOI-mejl.
    const { Resend } = await import("resend");
    const client = new Resend(apiKey);

    const result = await client.emails.send({
      from:    getFromAddress(),
      to:      intent.email,
      subject: "Bekräftelse — din avsiktsförklaring för Mailmind",
      html,
      text,
    });

    if (result.error) {
      console.error("[loi/email] send failed:", result.error);
      return { ok: false, error: String(result.error.message ?? result.error) };
    }
    return { ok: true, messageId: result.data?.id ?? "unknown" };
  } catch (err) {
    console.error("[loi/email] unexpected error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

// ── HTML-mall ─────────────────────────────────────────────────────────────────

function renderHtml({ intent, verifyUrl }: { intent: LoiConfirmationParams["intent"]; verifyUrl: string | null }): string {
  const signedAtSv = new Date(intent.signedAt).toLocaleString("sv-SE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone:  "Europe/Stockholm",
  });

  const role          = intent.role        ? escape(intent.role)        : "—";
  const companySize   = intent.companySize ? escape(intent.companySize) : "—";

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>Bekräftelse — Mailmind avsiktsförklaring</title>
</head>
<body style="margin:0;padding:0;background:#030614;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#030614;padding:40px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#0a0f1e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

          <tr><td style="padding:32px 32px 16px 32px;">
            <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#22d3ee;font-weight:700;">Bekräftelse</p>
            <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.01em;">Tack för din avsiktsförklaring</h1>
          </td></tr>

          <tr><td style="padding:0 32px 24px 32px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.78);">
              Hej ${escape(intent.name)}, vi har mottagit din avsiktsförklaring för <strong>${escape(intent.company)}</strong> att utvärdera Mailmind vid lansering. Vi hör av oss inför launch.
            </p>
          </td></tr>

          ${verifyUrl ? `
          <tr><td style="padding:0 32px 24px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.25);border-radius:12px;">
              <tr><td style="padding:16px 18px;">
                <p style="margin:0 0 8px 0;font-size:12px;color:rgba(255,255,255,0.7);">Bekräfta din mejladress så vi vet att du är du:</p>
                <a href="${verifyUrl}" style="display:inline-block;padding:8px 16px;border-radius:8px;background:#22d3ee;color:#030614;text-decoration:none;font-size:13px;font-weight:700;">Bekräfta mejl →</a>
              </td></tr>
            </table>
          </td></tr>` : ""}

          <tr><td style="padding:0 32px 24px 32px;">
            <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.55);font-weight:700;">Texten du godkände</p>
            <div style="border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px 16px;background:rgba(255,255,255,0.02);">
              <p style="margin:0;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.85);white-space:pre-wrap;">${escape(intent.intentText)}</p>
            </div>
          </td></tr>

          <tr><td style="padding:0 32px 24px 32px;">
            <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.55);font-weight:700;">Signatur</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;color:rgba(255,255,255,0.75);">
              <tr><td style="padding:3px 0;width:140px;color:rgba(255,255,255,0.55);">Namn</td><td style="padding:3px 0;">${escape(intent.name)}</td></tr>
              <tr><td style="padding:3px 0;color:rgba(255,255,255,0.55);">E-post</td><td style="padding:3px 0;">${escape(intent.email)}</td></tr>
              <tr><td style="padding:3px 0;color:rgba(255,255,255,0.55);">Företag</td><td style="padding:3px 0;">${escape(intent.company)}</td></tr>
              <tr><td style="padding:3px 0;color:rgba(255,255,255,0.55);">Roll</td><td style="padding:3px 0;">${role}</td></tr>
              <tr><td style="padding:3px 0;color:rgba(255,255,255,0.55);">Företagsstorlek</td><td style="padding:3px 0;">${companySize}</td></tr>
              <tr><td style="padding:3px 0;color:rgba(255,255,255,0.55);">Signerad</td><td style="padding:3px 0;">${escape(signedAtSv)}</td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:16px 32px 32px 32px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;line-height:1.6;color:rgba(255,255,255,0.45);">
              Detta är inte ett juridiskt bindande avtal — det är en daterad
              viljeyttring som hjälper oss förstå efterfrågan inför lansering.
              Spara gärna detta mejl. Har du frågor? Svara direkt på mejlet
              eller mejla <a href="mailto:hello@mailmind.se" style="color:#22d3ee;text-decoration:none;">hello@mailmind.se</a>.
            </p>
          </td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText({ intent, verifyUrl }: { intent: LoiConfirmationParams["intent"]; verifyUrl: string | null }): string {
  const signedAtSv = new Date(intent.signedAt).toLocaleString("sv-SE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone:  "Europe/Stockholm",
  });

  return [
    `Bekräftelse — Mailmind avsiktsförklaring`,
    ``,
    `Hej ${intent.name},`,
    ``,
    `Vi har mottagit din avsiktsförklaring för ${intent.company} att utvärdera Mailmind vid lansering. Vi hör av oss inför launch.`,
    ``,
    verifyUrl ? `Bekräfta din mejladress: ${verifyUrl}` : ``,
    ``,
    `--- Texten du godkände ---`,
    intent.intentText,
    ``,
    `--- Signatur ---`,
    `Namn:           ${intent.name}`,
    `E-post:         ${intent.email}`,
    `Företag:        ${intent.company}`,
    `Roll:           ${intent.role ?? "—"}`,
    `Företagsstorlek: ${intent.companySize ?? "—"}`,
    `Signerad:       ${signedAtSv}`,
    ``,
    `Detta är inte ett juridiskt bindande avtal — det är en daterad`,
    `viljeyttring som hjälper oss förstå efterfrågan inför lansering.`,
    `Har du frågor? Svara på detta mejl eller skriv till hello@mailmind.se`,
  ].filter(Boolean).join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
