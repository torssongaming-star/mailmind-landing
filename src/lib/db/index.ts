/**
 * Drizzle database client
 *
 * Uses Neon's serverless HTTP driver — no persistent TCP connections, works in
 * Vercel Edge Functions, serverless lambdas, and standard Node.js alike.
 *
 * If DATABASE_URL is not set (local dev without a DB), `db` is exported as
 * null. All query helpers in queries.ts check for this and fall back to mock
 * data automatically, so the app stays fully functional without a database.
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Export the schema so callers can import types without a second path
export * from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

/**
 * Returns the Drizzle client if DATABASE_URL is configured, or null.
 * Lazily initialised to avoid throwing at import time in environments where
 * the env var isn't set (e.g., build workers, local dev without a DB).
 */
function getDb(): DrizzleDb | null {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;

  const sql = neon(process.env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const client = getDb();
    if (!client) {
      // Hard-fail instead of silently returning null. Strategi-revision P2.2:
      // silent fallback masked config errors in production. Callers must gate
      // writes behind isDbConnected() and handle the no-DB case explicitly.
      throw new Error(
        `[db] access attempted (${String(prop)}) but DATABASE_URL is not set. ` +
        `Call isDbConnected() first.`,
      );
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** True when a real database connection is available */
export function isDbConnected(): boolean {
  return !!process.env.DATABASE_URL;
}
