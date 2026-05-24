/**
 * Validates the full environment-variable surface at boot.
 *
 * Two tiers:
 *   - REQUIRED: server cannot function — throws MissingEnvError, deploy fails
 *   - RECOMMENDED: feature degraded — logs structured warning, server boots
 *
 * Categorised by subsystem (auth, db, ai, billing, email, integrations,
 * observability) so missing-config errors point at the right team.
 *
 * Called once from src/instrumentation.ts. Safe to call multiple times —
 * idempotent and side-effect-free except for the throw/log.
 */

import { MissingEnvError, validateHexKey } from "./env";

export type CheckStatus = "ok" | "warn" | "error";
export type CheckCategory =
  | "db"
  | "auth"
  | "ai"
  | "email"
  | "billing"
  | "integrations"
  | "observability";

export type CheckResult = {
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  reason?: string;
};

const isProd = (): boolean => process.env.NODE_ENV === "production";

const isSet = (name: string): boolean => {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
};

/** Wrap a hard requirement so it lands as a result row instead of an uncaught throw. */
function hardRequire(name: string, category: CheckCategory): CheckResult {
  if (isSet(name)) return { name, category, status: "ok" };
  return {
    name,
    category,
    status: "error",
    reason: "required env var is missing — server cannot function",
  };
}

/** Hard in production, ok in dev when missing. */
function hardRequireInProd(name: string, category: CheckCategory): CheckResult {
  if (isSet(name)) return { name, category, status: "ok" };
  if (isProd()) {
    return {
      name,
      category,
      status: "error",
      reason: "required in production — set this before deploying",
    };
  }
  return {
    name,
    category,
    status: "warn",
    reason: "missing (allowed in dev — will be required in production)",
  };
}

/**
 * Validate that exactly one of two paired vars is set/unset together.
 * "Both unset" = feature disabled silently (no warning).
 * "One set, one missing" = misconfiguration → warn.
 * "Both set" = ok.
 */
function pairedOptional(
  a: string,
  b: string,
  category: CheckCategory,
  feature: string,
): CheckResult[] {
  const aSet = isSet(a);
  const bSet = isSet(b);
  if (!aSet && !bSet) {
    return [
      { name: `${a}+${b}`, category, status: "ok", reason: `${feature} disabled (both unset)` },
    ];
  }
  if (aSet && bSet) {
    return [{ name: `${a}+${b}`, category, status: "ok" }];
  }
  const missing = aSet ? b : a;
  return [
    {
      name: missing,
      category,
      status: "warn",
      reason: `${feature} half-configured — ${missing} missing while its pair is set`,
    },
  ];
}

/** Only check format/length if the var is set. Absence = provider not in use, no warning. */
function optionalHexKey(name: string, category: CheckCategory): CheckResult {
  if (!isSet(name)) {
    return { name, category, status: "ok", reason: "unset (provider not in use)" };
  }
  try {
    validateHexKey(name, process.env[name]);
    return { name, category, status: "ok" };
  } catch (err) {
    return {
      name,
      category,
      status: "error",
      reason: err instanceof Error ? err.message : "invalid hex key",
    };
  }
}

function softOptional(
  name: string,
  category: CheckCategory,
  reasonIfMissing: string,
): CheckResult {
  if (isSet(name)) return { name, category, status: "ok" };
  return { name, category, status: "warn", reason: reasonIfMissing };
}

/** Either of two alternate names accepted. */
function softOptionalEither(
  names: [string, string],
  category: CheckCategory,
  reasonIfMissing: string,
): CheckResult {
  const [a, b] = names;
  if (isSet(a) || isSet(b)) return { name: `${a}|${b}`, category, status: "ok" };
  return { name: `${a}|${b}`, category, status: "warn", reason: reasonIfMissing };
}

/** Hard requirement satisfied by either of two alternate names. */
function hardRequireEither(
  names: [string, string],
  category: CheckCategory,
): CheckResult {
  const [a, b] = names;
  if (isSet(a) || isSet(b)) return { name: `${a}|${b}`, category, status: "ok" };
  return {
    name: `${a}|${b}`,
    category,
    status: "error",
    reason: `required: set ${a} or ${b}`,
  };
}

const SEVERITY_ORDER: Record<CheckStatus, number> = { error: 0, warn: 1, ok: 2 };
const CATEGORY_ORDER: Record<CheckCategory, number> = {
  db: 0,
  auth: 1,
  ai: 2,
  email: 3,
  billing: 4,
  integrations: 5,
  observability: 6,
};

export function validateConfigOnStartup(): { ok: boolean; results: CheckResult[] } {
  const results: CheckResult[] = [];

  // --- db ---
  results.push(hardRequire("DATABASE_URL", "db"));

  // --- auth ---
  results.push(hardRequire("CLERK_SECRET_KEY", "auth"));
  results.push(
    hardRequireEither(["CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"], "auth"),
  );
  results.push(
    softOptional(
      "CLERK_WEBHOOK_SECRET",
      "auth",
      "user.deleted webhook handler will reject calls — recommended in production",
    ),
  );

  // --- ai ---
  results.push(hardRequire("ANTHROPIC_API_KEY", "ai"));
  results.push(softOptional("AI_MODEL", "ai", "falling back to default model"));

  // --- email (outbound + inbound) ---
  results.push(hardRequire("RESEND_API_KEY", "email"));
  results.push(
    softOptional(
      "RESEND_WEBHOOK_SECRET",
      "email",
      "Resend inbound webhook signature check disabled — only needed if inbound configured",
    ),
  );
  results.push(
    softOptional(
      "SENDGRID_INBOUND_SECRET",
      "email",
      "SendGrid inbound parse signature check disabled — only needed if SendGrid configured",
    ),
  );

  // --- billing ---
  results.push(hardRequireInProd("STRIPE_SECRET_KEY", "billing"));
  results.push(hardRequireInProd("STRIPE_WEBHOOK_SECRET", "billing"));

  // --- integrations (Gmail / Outlook) ---
  results.push(...pairedOptional("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "integrations", "Gmail integration"));
  results.push(optionalHexKey("GMAIL_ENCRYPT_KEY", "integrations"));
  results.push(
    softOptional(
      "GMAIL_PUSH_OIDC_AUDIENCE",
      "integrations",
      "Gmail push notifications disabled — only needed if Gmail push is used",
    ),
  );
  results.push(
    ...pairedOptional("OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET", "integrations", "Outlook integration"),
  );
  results.push(optionalHexKey("OUTLOOK_ENCRYPT_KEY", "integrations"));
  results.push(
    softOptional(
      "MICROSOFT_CLIENT_STATE",
      "integrations",
      "Outlook webhook clientState fallback in use — recommended to set explicitly",
    ),
  );

  // --- ops (cron / admin) — billed under integrations so a single category covers ops endpoints ---
  results.push(hardRequireInProd("CRON_SECRET", "integrations"));
  results.push(hardRequireInProd("ADMIN_HEALTH_SECRET", "integrations"));

  // --- observability ---
  // Upstash Redis pair: same rules as other paired vars, but "both unset in prod"
  // is itself a soft warning because we fall back to in-memory rate limiting.
  const upstashUrl = isSet("UPSTASH_REDIS_REST_URL");
  const upstashTok = isSet("UPSTASH_REDIS_REST_TOKEN");
  if (upstashUrl && upstashTok) {
    results.push({ name: "UPSTASH_REDIS_REST_URL+UPSTASH_REDIS_REST_TOKEN", category: "observability", status: "ok" });
  } else if (upstashUrl !== upstashTok) {
    const missing = upstashUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL";
    results.push({
      name: missing,
      category: "observability",
      status: "warn",
      reason: "Upstash Redis half-configured — both URL and TOKEN must be set",
    });
  } else if (isProd()) {
    results.push({
      name: "UPSTASH_REDIS_REST_URL+UPSTASH_REDIS_REST_TOKEN",
      category: "observability",
      status: "warn",
      reason: "in-memory rate limit in production — set Upstash Redis for distributed limiting",
    });
  } else {
    results.push({
      name: "UPSTASH_REDIS_REST_URL+UPSTASH_REDIS_REST_TOKEN",
      category: "observability",
      status: "ok",
      reason: "Upstash Redis disabled (both unset) — in-memory rate limit in use",
    });
  }
  results.push(
    ...pairedOptional(
      "NEXT_PUBLIC_POSTHOG_KEY",
      "NEXT_PUBLIC_POSTHOG_HOST",
      "observability",
      "PostHog analytics",
    ),
  );
  results.push(
    softOptionalEither(
      ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN"],
      "observability",
      "Sentry error tracking disabled — set NEXT_PUBLIC_SENTRY_DSN or SENTRY_DSN",
    ),
  );

  // Sort: category, then severity (error → warn → ok)
  results.sort((a, b) => {
    const c = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (c !== 0) return c;
    return SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status];
  });

  const ok = !results.some((r) => r.status === "error");
  return { ok, results };
}

/** Convenience: format the failing names for a thrown error message. */
export function collectErrorNames(results: CheckResult[]): string[] {
  return results.filter((r) => r.status === "error").map((r) => r.name);
}

/** Re-export so callers can `throw new MissingEnvError(...)` without a second import. */
export { MissingEnvError };
