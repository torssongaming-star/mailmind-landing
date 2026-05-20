/**
 * Detects emails sent by Mailmind itself.
 *
 * Mailmind sends notification mail (new-thread alerts, weekly reports,
 * trial reminders, etc.) from a small set of addresses on mailmind.se.
 * When the recipient's inbox is *also* connected to Mailmind via Gmail
 * Push / Microsoft Graph / Sendgrid, those notifications loop back in
 * as new "customer" threads — which is pure noise.
 *
 * Use this check at every inbound entry point. If it returns true, skip
 * the thread/message creation entirely (don't even store it).
 */
const SYSTEM_SENDER_DOMAINS = ["mailmind.se"];

const SYSTEM_SENDER_ADDRESSES = new Set<string>([
  "noreply@mailmind.se",
  "no-reply@mailmind.se",
  "support@mailmind.se",
  "dmarc@mailmind.se",
  "billing@mailmind.se",
]);

export function isSystemSender(fromEmail: string): boolean {
  const e = fromEmail.toLowerCase().trim();
  if (!e || !e.includes("@")) return false;
  if (SYSTEM_SENDER_ADDRESSES.has(e)) return true;
  const domain = e.slice(e.lastIndexOf("@") + 1);
  return SYSTEM_SENDER_DOMAINS.includes(domain);
}
