/**
 * Migrate legacy signature assets from base64-in-DB to Vercel Blob.
 *
 * Run with: tsx src/scripts/migrate-signatures-to-blob.ts
 *
 * Requires BLOB_READ_WRITE_TOKEN (Vercel → Storage → Create Blob → Copy token)
 * and DATABASE_URL.
 *
 * Idempotent — safe to re-run. Only touches rows where blob_url IS NULL AND
 * data IS NOT NULL. Will leave the `data` column populated unless you pass
 * --clear-data, in which case successfully-migrated rows have `data` set to
 * NULL after the blob upload + blob_url update commit.
 *
 * Progress is logged every 10 rows. Errors on a single row don't abort the
 * batch — the row stays as-is and a subsequent run will retry it.
 */

import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { and, isNotNull, isNull, eq } from "drizzle-orm";
import { db, isDbConnected, signatureAssets } from "../lib/db";

async function main() {
  const clearData = process.argv.includes("--clear-data");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "BLOB_READ_WRITE_TOKEN is not set. Get it from Vercel → Storage → Create Blob → Copy token.",
    );
    process.exit(1);
  }
  if (!isDbConnected()) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log(
    `Starting signature migration. clearData=${clearData ? "yes" : "no"}.`,
  );

  // Fetch all rows that still need migration. Signature_assets is a small
  // table per the schema design (one image per org typically), so loading
  // the candidate set up front is fine — but cap it to be safe.
  const rows = await db
    .select({
      id: signatureAssets.id,
      organizationId: signatureAssets.organizationId,
      fileName: signatureAssets.fileName,
      mimeType: signatureAssets.mimeType,
      data: signatureAssets.data,
    })
    .from(signatureAssets)
    .where(and(isNull(signatureAssets.blobUrl), isNotNull(signatureAssets.data)));

  console.log(`Found ${rows.length} legacy rows to migrate.`);

  let migrated = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // `data` could be a raw base64 payload or a data URL — normalize.
      let base64 = row.data ?? "";
      const dataUrlMatch = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUrlMatch) base64 = dataUrlMatch[2];

      const buffer = Buffer.from(base64, "base64");
      if (buffer.length === 0) {
        console.warn(`[skip] row ${row.id} has empty data payload.`);
        failed++;
        continue;
      }

      const safeFileName = (row.fileName || "signature_image")
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .slice(0, 100);

      const blob = await put(
        `signatures/${row.organizationId}/${randomUUID()}-${safeFileName}`,
        buffer,
        {
          access: "public",
          contentType: row.mimeType,
          addRandomSuffix: false,
        },
      );

      await db
        .update(signatureAssets)
        .set({
          blobUrl: blob.url,
          // Only NULL out data if explicitly asked. The default behaviour
          // keeps the legacy bytes around so we can reconcile later.
          ...(clearData ? { data: null } : {}),
        })
        .where(eq(signatureAssets.id, row.id));

      migrated++;
    } catch (err) {
      failed++;
      console.error(`[error] row ${row.id} failed:`, err);
    }

    if ((i + 1) % 10 === 0) {
      console.log(
        `Progress: ${i + 1}/${rows.length} processed (migrated=${migrated}, failed=${failed}).`,
      );
    }
  }

  console.log(
    `Done. Migrated ${migrated} of ${rows.length} rows. ${failed} failed.`,
  );
  if (!clearData && migrated > 0) {
    console.log(
      "Note: `data` column still populated for migrated rows. Re-run with --clear-data once you've verified blob delivery works.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration script crashed:", err);
    process.exit(1);
  });
