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
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Boot-time env validation — throws loudly if any required var is missing
    // in production, so Vercel surfaces the failure during deploy/cold start.
    const { assertSet, requireInProduction } = await import("./lib/env");
    assertSet("DATABASE_URL", "CLERK_SECRET_KEY", "ANTHROPIC_API_KEY", "RESEND_API_KEY");
    requireInProduction("STRIPE_WEBHOOK_SECRET");
    requireInProduction("CRON_SECRET");
    requireInProduction("ADMIN_HEALTH_SECRET");
    requireInProduction("GMAIL_PUSH_OIDC_AUDIENCE"); // only enforced if Gmail integration is in use
  }
}
