/**
 * Outbound email — Resend wrapper.
 *
 * Used by the draft "send" action to dispatch AI-generated replies to customers.
 * Resend was already a dependency (used by /api/demo-request); we reuse the
 * same client here.
 *
 * From-address resolution:
 *   1. MAILMIND_FROM_EMAIL env var (preferred — set per deployment)
 *   2. Fallback: noreply@mailmind.se (must be a verified domain in Resend)
 *
 * Phase 4 (multi-tenant): customers will send from their own domain
 * (support@<their-domain>.com). Until then, all replies come from mailmind.se.
 */

import { Resend } from "resend";

let _client: Resend | null = null;
function getClient(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  _client = new Resend(key);
  return _client;
}

const FROM_DEFAULT = "Mailmind <noreply@mailmind.se>";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  /** Optional reply-to (e.g. the customer's address routed back through us) */
  replyTo?: string;
  /** Override the from address — defaults to MAILMIND_FROM_EMAIL or noreply */
  from?: string;
  /** Custom headers (Message-ID, In-Reply-To, References, etc.) */
  headers?: Record<string, string>;
};

/** Append a signature to the body if one is provided. Pure helper. */
export function appendSignature(body: string, signature?: string | null): string {
  if (!signature?.trim()) return body;
  // Two newlines before, then signature with no leading whitespace
  return body.replace(/\s+$/, "") + "\n\n" + signature.trim();
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Send a single email via Resend.
 * Never throws — returns a result object so callers can react to failures
 * without try/catch.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const client = getClient();
    const from = input.from ?? process.env.MAILMIND_FROM_EMAIL ?? FROM_DEFAULT;

    const result = await client.emails.send({
      from,
      to:      input.to,
      subject: input.subject,
      text:    input.text,
      replyTo: input.replyTo,
      headers: input.headers,
    });

    if (result.error) {
      return { ok: false, error: result.error.message ?? "Resend error" };
    }
    return { ok: true, id: result.data?.id ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error";
    console.error("[email] send failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Helper: build a "Re: ..." subject line, only adding the prefix if it isn't
 * already there.
 */
export function replySubject(original: string | null | undefined): string {
  if (!original) return "Re:";
  return /^re:\s/i.test(original) ? original : `Re: ${original}`;
}
