-- =============================================================================
-- email_messages backfill — required BEFORE the matching schema push goes live
-- =============================================================================
--
-- Schema now declares `email_messages.organization_id` as NOT NULL. If any row
-- in production still has NULL, db:push will fail when it tries to add the
-- NOT NULL constraint. Run this in Neon SQL Editor first.
--
-- Already executed once per manuella-steg.md §2 (May 2026). Keeping this file
-- as the canonical reproducible script — re-run is idempotent.
-- =============================================================================

-- Step 1: fill in any missing organizationId by inheriting from the thread.
UPDATE email_messages m
   SET organization_id = t.organization_id
  FROM email_threads t
 WHERE m.thread_id = t.id
   AND m.organization_id IS NULL;

-- Step 2: verify zero NULLs remain. Expected result: 0.
-- Do NOT proceed to step 3 unless this returns 0.
SELECT COUNT(*) AS unmapped FROM email_messages WHERE organization_id IS NULL;

-- Step 3: enforce NOT NULL at the column level. Only run after Step 2 = 0.
-- (Drizzle's db:push will also attempt this — running it here first makes the
-- failure visible in SQL Editor instead of in a half-applied push.)
ALTER TABLE email_messages
  ALTER COLUMN organization_id SET NOT NULL;

-- Step 4 (optional, idempotent): re-create the unique index as PARTIAL.
-- Schema now matches what Neon already has, but if you ever wipe & recreate
-- the index, this is the canonical form.
-- DROP INDEX IF EXISTS email_messages_external_id_uniq;
-- CREATE UNIQUE INDEX email_messages_external_id_uniq
--   ON email_messages (external_message_id)
--   WHERE external_message_id IS NOT NULL;
