/**
 * Transactional email notifications via Resend.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Mailmind <notiser@mail.mailmind.se>";

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
