/**
 * Atomic OFF-YYYY-NNNN quote number sequencing.
 *
 * Uses an upsert against `quoting_quote_number_sequences` to atomically
 * increment the per-(org, year) counter and return the next formatted number.
 *
 * Concurrent quote creation within the same org/year is safe: the upsert
 * runs an atomic increment via `SET last_used = last_used + 1` with a
 * conflict target on the unique (organization_id, year) index.
 *
 * Example output: "OFF-2026-0001", "OFF-2026-0042", "OFF-2026-1000"
 */

import { eq, and, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { quotingQuoteNumberSequences } from "@/lib/db/schema";

// Accept the db instance as a parameter so callers can pass a transaction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function nextQuoteNumber(db: NeonHttpDatabase<any>, orgId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Upsert: insert row with lastUsed=1 on first use, or increment on conflict.
  // RETURNING gives us the *new* (post-increment) value atomically.
  const rows = await db
    .insert(quotingQuoteNumberSequences)
    .values({
      organizationId: orgId,
      year,
      lastUsed: 1,
    })
    .onConflictDoUpdate({
      target: [quotingQuoteNumberSequences.organizationId, quotingQuoteNumberSequences.year],
      set: {
        lastUsed: sql`${quotingQuoteNumberSequences.lastUsed} + 1`,
      },
    })
    .returning({ lastUsed: quotingQuoteNumberSequences.lastUsed });

  const seq = rows[0].lastUsed;
  return `OFF-${year}-${String(seq).padStart(4, "0")}`;
}

// Utility: peek at the current sequence without incrementing (useful for tests).
export async function peekQuoteSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NeonHttpDatabase<any>,
  orgId: string,
): Promise<number> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ lastUsed: quotingQuoteNumberSequences.lastUsed })
    .from(quotingQuoteNumberSequences)
    .where(
      and(
        eq(quotingQuoteNumberSequences.organizationId, orgId),
        eq(quotingQuoteNumberSequences.year, year),
      ),
    )
    .limit(1);
  return rows[0]?.lastUsed ?? 0;
}
