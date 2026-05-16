/**
 * Transactional email notifications via Resend.
 */

import { Resend } from "resend";
import type { WeeklyStats } from "./stats";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Mailmind <noreply@mailmind.se>";

export async function notifyNewThread(input: {
  toEmail: string;
  fromName: string | null;
  fromEmail: string;
  subject: string | null;
  threadId: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: input.toEmail,
    subject: `Nytt ärende: ${input.subject ?? "(inget ämne)"}`,
    html: `<p>Ett nytt mejl har kommit in från <strong>${input.fromName ?? input.fromEmail}</strong>.</p>
<p><a href="https://mailmind.se/app/thread/${input.threadId}">Visa ärendet →</a></p>`,
  });
}

export async function notifyUsageWarning(input: {
  toEmail: string;
  used: number;
  limit: number;
  orgName: string;
}) {
  const pct = Math.round((input.used / input.limit) * 100);
  await resend.emails.send({
    from: FROM,
    to: input.toEmail,
    subject: `⚠️ ${pct}% av din AI-kvot används – ${input.orgName}`,
    html: `<p>Du har använt <strong>${input.used} av ${input.limit}</strong> AI-svar (${pct}%) denna månad.</p>
<p><a href="https://mailmind.se/dashboard/billing">Uppgradera din plan →</a></p>`,
  });
}

export async function notifyTrialExpired(input: {
  toEmail: string;
  orgName: string;
  plan: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: input.toEmail,
    subject: `Din gratis provperiod har gått ut – ${input.orgName}`,
    html: `<p>Hej!</p>
<p>Din 14-dagars provperiod för <strong>${input.orgName}</strong> har gått ut och AI-funktionerna är nu inaktiverade.</p>
<p>Välj ett abonnemang för att fortsätta ta emot och svara på kundmejl med AI.</p>
<p><a href="https://mailmind.se/dashboard/billing">Välj abonnemang →</a></p>
<p>Har du frågor? Svara på detta mejl så hjälper vi dig.</p>`,
  });
}

/**
 * Sent to org owner when Outlook subscription renewal has failed twice in a
 * row — the inbox has been silent for at least 24h and needs reconnection.
 */
export async function notifyInboxRenewalFailed(input: {
  toEmail:    string;
  inboxEmail: string;
}) {
  const reconnectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se"}/app/inboxes`;
  await resend.emails.send({
    from:    FROM,
    to:      input.toEmail,
    subject: `Åtgärd krävs: anslutningen till ${input.inboxEmail} har avbrutits`,
    html: `<p>Hej!</p>
<p>Vi har inte kunnat förnya anslutningen till din Outlook-inkorg <strong>${input.inboxEmail}</strong> de senaste två dygnen. Inga nya mejl har därför kommit in i Mailmind under denna tid.</p>
<p><a href="${reconnectUrl}" style="display:inline-block;background:#06b6d4;color:#030614;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">Återanslut inkorgen →</a></p>
<p style="color:#64748b;font-size:12px;">Klicka "Koppla bort" och sedan "Koppla Outlook" igen för att återställa anslutningen. Inkomna mejl medan anslutningen var avbruten visas inte automatiskt — kolla din ursprungliga inkorg och vidarebefordra vid behov.</p>`,
  });
}

export async function notifyInvite(input: {
  toEmail:   string;
  invitedBy: string;
  orgName:   string;
  role:      string;
  token:     string;
}) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se"}/api/app/team/accept?token=${input.token}`;
  const roleLabel = input.role === "admin" ? "Administratör" : "Medlem";
  await resend.emails.send({
    from: FROM,
    to:   input.toEmail,
    subject: `Du har bjudits in till ${input.orgName} på Mailmind`,
    html: `<p>Hej!</p>
<p><strong>${input.invitedBy}</strong> har bjudit in dig att gå med i <strong>${input.orgName}</strong> på Mailmind som <strong>${roleLabel}</strong>.</p>
<p><a href="${url}" style="display:inline-block;background:#06b6d4;color:#030614;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">Acceptera inbjudan →</a></p>
<p style="color:#64748b;font-size:12px;">Länken är giltig i 72 timmar. Om du inte har ett konto skapar du ett kostnadsfritt.</p>`,
  });
}

export async function notifyWeeklyReport(toEmail: string, stats: WeeklyStats) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });

  const aiRate = stats.newThreads > 0
    ? Math.round((stats.draftsSent / stats.newThreads) * 100)
    : 0;

  const rows = [
    ["📨 Nya ärenden",       stats.newThreads],
    ["✅ Lösta ärenden",     stats.resolvedThreads],
    ["⚡ Eskalerade",        stats.escalatedThreads],
    ["🤖 AI-svar skickade",  stats.draftsSent],
    ["📊 AI-svarsfrekvens",  `${aiRate}%`],
    ...(stats.topCaseType ? [["🏷️ Vanligaste typ", stats.topCaseType]] : []),
  ] as [string, string | number][];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;">${label}</td>
      <td style="padding:10px 16px;color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #1e293b;">${value}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:0 0 24px 0;">
            <p style="margin:0;color:#06b6d4;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Mailmind</p>
            <h1 style="margin:8px 0 4px;color:#f1f5f9;font-size:22px;font-weight:700;">Veckans sammanfattning</h1>
            <p style="margin:0;color:#64748b;font-size:13px;">${fmt(stats.weekStart)} – ${fmt(stats.weekEnd)} &nbsp;·&nbsp; ${stats.orgName}</p>
          </td>
        </tr>

        <!-- Stats table -->
        <tr>
          <td style="background:#1e293b;border-radius:12px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${tableRows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 0 0 0;text-align:center;">
            <a href="https://mailmind.se/app" style="display:inline-block;background:#06b6d4;color:#030614;font-size:13px;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:8px;">
              Öppna inkorgen →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:32px 0 0 0;text-align:center;color:#475569;font-size:11px;">
            Du får detta mejl varje måndag. <a href="https://mailmind.se/app/settings" style="color:#475569;">Hantera notiser</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to:   toEmail,
    subject: `Veckans sammanfattning – ${stats.orgName}`,
    html,
  });
}
