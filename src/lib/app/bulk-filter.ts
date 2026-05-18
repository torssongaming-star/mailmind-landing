/**
 * Bulk / marketing email detection.
 *
 * Detects mass-mailings, newsletters, and automated notifications BEFORE the
 * AI triage runs. Saves API cost and keeps the customer's inbox clean.
 *
 * Detection is intentionally conservative — we'd rather let a borderline
 * marketing email through than accidentally filter a real customer query.
 *
 * Three signal layers (all checked, first match wins):
 *   1. Sender address    — noreply@, no-reply@, known ESP send domains
 *   2. Subject keywords  — Swedish + English newsletter/promo vocabulary
 *   3. Body text         — "unsubscribe" / "avregistrera" presence
 *
 * No ML, no API calls — pure string matching, runs in <1 ms.
 */

// ── Layer 1 — Sender patterns ─────────────────────────────────────────────────

/**
 * Local-part prefixes that are structurally bulk (RFC-wise these should never
 * be replied to by a human). Case-insensitive prefix match.
 */
const BULK_SENDER_PREFIXES = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "newsletter",
  "newsletters",
  "marketing",
  "campaign",
  "campaigns",
  "promo",
  "promotions",
  "offers",
  "deals",
  "notifications",     // usually automated system emails
  "automail",
  "auto-mailer",
  "mailer",
  "mailinglist",
  "mailing-list",
  "listserv",
  "bounce",
  "bounces",
  "unsubscribe",
];

/**
 * Domains that are exclusively used for bulk/transactional send infrastructure.
 * These are ESP (Email Service Provider) sending domains — never direct humans.
 */
const BULK_SENDER_DOMAINS = [
  // ESPs — sending infrastructure
  "mailchimp.com",
  "mc.email",                // Mailchimp
  "klaviyo.com",
  "kx.com",                  // Klaviyo
  "sendgrid.net",
  "sendgrid.com",
  "em.sendgrid.net",
  "hubspot.com",
  "hs-email.com",            // HubSpot
  "marketo.com",
  "mktoresp.com",            // Marketo / Adobe
  "salesforce.com",
  "exacttarget.com",
  "pardot.com",              // Salesforce Marketing Cloud
  "constantcontact.com",
  "r.constantcontact.com",
  "mailgun.org",
  "mailgun.info",
  "mg.mailgun.com",
  "drip.com",
  "getdrip.com",
  "activecampaign.com",
  "postmarkapp.com",
  "sparkpostmail.com",
  "sendpulse.com",
  "brevo.com",               // ex-Sendinblue
  "sendinblue.com",
  "mailerlite.com",
  "convertkit.com",
  "ck.email",                // ConvertKit
  "aweber.com",
  "getresponse.com",
  "omnisend.com",
  "iterable.com",
  "sailthru.com",
  "responsys.com",           // Oracle
  "eloqua.com",
  "dotdigital.com",
  "emarsys.com",
  "listrak.com",
  "yotpo.com",
  "attentivemobile.com",
  "smtpapi.com",
  // Swedish/Nordic ESPs
  "apsis.com",
  "episerver.net",
  "ccsend.com",              // Constant Contact bounce domain
];

// ── Layer 2 — Subject keyword patterns ───────────────────────────────────────

/**
 * High-confidence bulk subject tokens. Matched as whole words (case-insensitive).
 * Tuned for Swedish SMB context — avoids common business words.
 */
const BULK_SUBJECT_TOKENS = [
  // Swedish
  "nyhetsbrev",
  "nyhetsmail",
  "veckobrev",
  "månadsbrev",
  "erbjudande",
  "erbjudanden",
  "rabatt",
  "rabattkod",
  "kampanj",
  "rea",
  "realisering",
  "extrapris",
  "välkommen tillbaka",
  "vi saknar dig",
  "exklusivt erbjudande",
  "avregistrera",
  "prenumerera",
  // English
  "newsletter",
  "unsubscribe",
  "special offer",
  "exclusive offer",
  "limited time",
  "flash sale",
  "last chance",
  "don't miss",
  "act now",
  "% off",
  "% rabatt",
  "free shipping",
  "gratis frakt",
  "black friday",
  "cyber monday",
  "weekly digest",
  "monthly digest",
  "roundup",
  "re-engagement",
  "we miss you",
  "come back",
];

// ── Layer 3 — Body signal ─────────────────────────────────────────────────────

/**
 * Single strongest body signal: presence of an unsubscribe link or instruction.
 * GDPR-regulated bulk email must include this — legit customer emails never do.
 */
const BODY_UNSUBSCRIBE_PATTERNS = [
  "unsubscribe",
  "avregistrera dig",
  "avprenumerera",
  "opt out",
  "opt-out",
  "ta bort mig",
  "klicka här för att avregistrera",
  "click here to unsubscribe",
  "manage your email preferences",
  "hantera dina e-postinställningar",
  "update your preferences",
  "email preferences",
  "mailing preferences",
];

// ── Detection ─────────────────────────────────────────────────────────────────

export type BulkSignal =
  | { detected: false }
  | { detected: true; reason: string; layer: "sender" | "subject" | "body" };

/**
 * Analyse an incoming email and return whether it looks like bulk/marketing.
 *
 * All three layers are evaluated but the function short-circuits on first
 * confident hit (Layer 1 > 2 > 3 in terms of false-positive risk).
 */
export function detectBulkEmail(params: {
  fromEmail: string;
  subject:   string;
  bodyText:  string;
}): BulkSignal {
  const from    = params.fromEmail.toLowerCase().trim();
  const subject = params.subject.toLowerCase();
  const body    = params.bodyText.toLowerCase();

  // ── Layer 1: sender address ───────────────────────────────────────────────
  const [localPart, senderDomain] = from.split("@");

  // Known bulk ESP sending domain
  if (senderDomain) {
    // Exact domain match OR subdomain of a known bulk domain
    // e.g. "em123.mailchimp.com" → matches "mailchimp.com"
    const domainHit = BULK_SENDER_DOMAINS.find(
      d => senderDomain === d || senderDomain.endsWith(`.${d}`),
    );
    if (domainHit) {
      return {
        detected: true,
        layer:    "sender",
        reason:   `ESP domain: ${domainHit}`,
      };
    }
  }

  // Bulk local-part prefix
  if (localPart) {
    // Strip + aliases and dots (gmail ignores dots, + is sub-addressing)
    const cleanLocal = localPart.split("+")[0].replace(/\./g, "");
    const prefixHit = BULK_SENDER_PREFIXES.find(
      p => cleanLocal === p || cleanLocal.startsWith(p),
    );
    if (prefixHit) {
      return {
        detected: true,
        layer:    "sender",
        reason:   `Bulk sender prefix: ${prefixHit}`,
      };
    }
  }

  // ── Layer 2: subject ──────────────────────────────────────────────────────
  const subjectHit = BULK_SUBJECT_TOKENS.find(token => subject.includes(token));
  if (subjectHit) {
    return {
      detected: true,
      layer:    "subject",
      reason:   `Subject token: "${subjectHit}"`,
    };
  }

  // ── Layer 3: body (unsubscribe signal) ────────────────────────────────────
  // Only triggered when body is non-trivially long (> 200 chars) to avoid
  // false-positives from customers asking "how do I unsubscribe from X?"
  if (body.length > 200) {
    const bodyHit = BODY_UNSUBSCRIBE_PATTERNS.find(p => body.includes(p));
    if (bodyHit) {
      return {
        detected: true,
        layer:    "body",
        reason:   `Body signal: "${bodyHit}"`,
      };
    }
  }

  return { detected: false };
}
