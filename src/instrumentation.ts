/**
 * Next.js instrumentation hook — runs once per server cold start.
 *
 * Two responsibilities:
 *   1. Initialise Sentry on the server runtime (sentry.server.config.ts)
 *   2. Validate env vars at boot — fail fast on misconfigured deploys instead
 *      of surfacing as 500s on the first user request.
 *
 * Only runs in the Node.js runtime. Edge runtime is intentionally skipped
 * since neither Sentry-Node nor the env helpers run there.
 */
import * as Sentry from "@sentry/nextjs";

// Next.js 15+ calls this hook for any error in server components or route
// handlers. Without forwarding to Sentry.captureRequestError, thrown errors
// land in Vercel logs but never reach Sentry — exactly what we hit.
export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Boot-time env validation — single comprehensive check across all subsystems.
    // Throws loudly if any required var is missing in production so Vercel surfaces
    // the failure during deploy/cold start. Soft warnings degrade gracefully.
    const { validateConfigOnStartup, collectErrorNames, MissingEnvError } = await import(
      "./lib/startup-validation"
    );
    const { ok, results } = validateConfigOnStartup();

    const errorCount = results.filter((r) => r.status === "error").length;
    const warnCount = results.filter((r) => r.status === "warn").length;
    const okCount = results.filter((r) => r.status === "ok").length;

    // Structured summary so the deploy log shows the boot state at a glance.
    console.log(
      `[startup] env check: ${okCount} ok, ${warnCount} soft warnings, ${errorCount} hard errors`,
    );

    for (const r of results) {
      if (r.status === "warn") {
        console.warn(`[startup][warn][${r.category}] ${r.name}: ${r.reason}`);
      } else if (r.status === "error") {
        console.error(`[startup][error][${r.category}] ${r.name}: ${r.reason}`);
      }
    }

    if (!ok) {
      const missing = collectErrorNames(results);
      // In production any error must crash boot so the deploy fails.
      // In dev we still log the errors above but allow the server to start
      // so local work isn't blocked by an unset Stripe or admin secret.
      if (process.env.NODE_ENV === "production") {
        throw new MissingEnvError(missing);
      } else {
        console.warn(
          `[startup] ${missing.length} required vars missing — would fail in production: ${missing.join(", ")}`,
        );
      }
    }
  }
}
