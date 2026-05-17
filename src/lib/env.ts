/**
 * Environment variable validation — server-side only.
 *
 * Single source of truth for "is this env var set?" checks. Used by:
 *   - Webhook routes: hard-fail at request time if a critical secret is missing
 *   - Token helpers: throw a clear error instead of silent crypto failures
 *   - Cron: validate CRON_SECRET is present, not just that the header matches
 *
 * Categorisation:
 *   required()  → throws if missing (use for critical paths)
 *   optional()  → returns undefined if missing (use for optional features)
 *   assertSet() → throws with a clear message if any of the listed names are missing
 *
 * NEVER use this in client code — env vars without NEXT_PUBLIC_ are server-only.
 */

export class MissingEnvError extends Error {
  constructor(public readonly names: string[]) {
    super(
      `Missing required environment variables: ${names.join(", ")}. ` +
      `Set them in your Vercel project settings or .env.local.`,
    );
    this.name = "MissingEnvError";
  }
}

/** Return value of env.NAME, throwing MissingEnvError if not set */
export function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) throw new MissingEnvError([name]);
  return v;
}

/** Return env.NAME or undefined */
export function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

/** Throw if any of the listed vars is missing. Use at the top of a code path
 *  that needs all of them — gives a single combined error message. */
export function assertSet(...names: string[]): void {
  const missing = names.filter(n => {
    const v = process.env[n];
    return !v || v.length === 0;
  });
  if (missing.length > 0) throw new MissingEnvError(missing);
}

/**
 * Validate a hex-encoded encryption key. Throws clear errors on:
 *   - Missing / wrong length (must be 64 hex chars = 32 bytes for AES-256)
 *   - Non-hex / known placeholder values
 */
export function validateHexKey(name: string, hex: string | undefined): Buffer {
  if (!hex) throw new MissingEnvError([name]);
  if (hex.length !== 64) {
    throw new Error(`${name} must be 64 hex chars (32 bytes). Got ${hex.length} chars.`);
  }
  if (!/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`${name} must be hex (0-9, a-f).`);
  }
  if (/^0+$/.test(hex)) {
    throw new Error(`${name} is all zeros — looks like a placeholder. Generate a proper random key.`);
  }
  return Buffer.from(hex, "hex");
}

/**
 * Detect env-name divergence at startup so misconfigured deployments fail
 * loudly. Accepts canonical name first, falls back to legacy. Warns when only
 * the legacy is set, errors when both differ.
 */
export function resolveLegacyEnv(canonical: string, legacy: string): string | undefined {
  const c = process.env[canonical];
  const l = process.env[legacy];
  if (c && l && c !== l) {
    console.error(`[env] BOTH ${canonical} and ${legacy} set with DIFFERENT values. Using ${canonical}.`);
    return c;
  }
  if (c) return c;
  if (l) {
    console.warn(`[env] Using legacy ${legacy}. Migrate to ${canonical}.`);
    return l;
  }
  return undefined;
}

/** Compare a header value against an expected secret using constant-time
 *  comparison. Returns false if either side is empty (no false-pass on undefined). */
export function constantTimeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
