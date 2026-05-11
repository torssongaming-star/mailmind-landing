/**
 * Shared constants for the admin module.
 * Kept separate from actions.ts ("use server") since Next.js only allows
 * async function exports from server action files.
 */

/** Number of approved dry-run iterations required before auto-send may be activated. */
export const DRY_RUN_THRESHOLD = 20;
