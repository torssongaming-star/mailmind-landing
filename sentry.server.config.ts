/**
 * Sentry — server-side initialization.
 *
 * Strategi-revision P6.3. Only initialises when SENTRY_DSN is set, so the
 * app works fine without Sentry in dev. PII filter strips emails / Bearer
 * tokens before send.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? "development",
    // Strip PII before send — strategi-revision: log helper already masks
    // for console; we replicate the same logic here for Sentry events.
    beforeSend(event) {
      const json = JSON.stringify(event);
      const masked = json
        .replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1***$2")
        .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/g, "Bearer ***")
        .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-hex]");
      return JSON.parse(masked) as Sentry.ErrorEvent;
    },
    ignoreErrors: [
      // Noise — Next.js redirect throws by design
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],
  });
}
