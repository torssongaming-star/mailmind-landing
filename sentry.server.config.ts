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
    debug: process.env.SENTRY_DEBUG === "1",
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? "development",
    // Strip PII before send — strategi-revision: log helper already masks
    // for console; we replicate the same logic here for Sentry events.
    beforeSend(event) {
      // Mask PII in the *message and exception fields only* — masking the
      // whole envelope JSON breaks Sentry's own event_id (32-char hex) and
      // trace IDs, which makes Sentry return 400 and silently drop the event.
      const maskString = (s: string) =>
        s
          .replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1***$2")
          .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/g, "Bearer ***");

      if (event.message) event.message = maskString(event.message);
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = maskString(ex.value);
        }
      }
      return event;
    },
    ignoreErrors: [
      // Noise — Next.js redirect throws by design
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],
  });
}
