/**
 * App audit log writer — server-side only.
 *
 * Thin typed wrapper around queries.writeAuditLog. The action field is a
 * string in the DB (varchar 100) but we constrain it here so callers can't
 * accidentally write typoed action names.
 *
 * Existing actions written by the website portal:
 *   checkout_completed | subscription_updated | subscription_canceled
 *   payment_succeeded | payment_failed
 *
 * App-specific actions added below. Keep these in sync with the dashboard's
 * audit log viewer (when one exists).
 */

import { writeAuditLog as dbWriteAuditLog } from "@/lib/db/queries";
import { maskEmail } from "@/lib/utils";

/**
 * Strategi-revision P2.9: audit-log lagrade tidigare PII (from, email, to) i
 * klartext i DB. Vi maskar nu i metadata-objektet innan write — DSAR-export
 * blir kortare och retention-risken sjunker.
 *
 * Maskerar:
 *   - Värden i kända PII-nycklar (email, from, to, fromEmail, etc) via maskEmail
 *   - Strängar i body/text/preview/subject/reason (trunkeras till 200 tecken)
 * Behåller:
 *   - threadId, draftId, inboxId (UUIDs är inte direkt PII)
 *   - tal, booleans, status
 */
const PII_EMAIL_KEYS = new Set([
  "email", "from", "to", "fromEmail", "toEmail", "memberEmail",
  "actorEmail", "userEmail", "invitedEmail",
]);
const PII_TEXT_KEYS = new Set([
  "body", "bodyText", "text", "snippet", "preview", "subject", "reason",
]);

function maskMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string" && PII_EMAIL_KEYS.has(k)) {
      out[k] = maskEmail(v);
    } else if (typeof v === "string" && PII_TEXT_KEYS.has(k)) {
      out[k] = v.length > 200 ? v.slice(0, 200) + "…[truncated]" : v;
    } else if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = maskMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export type AuditAction =
  // App actions (Mailmind email triage)
  | "ai_draft_generated"
  | "ai_dry_run_generated"
  | "ai_draft_skipped"
  | "ai_draft_edited"
  | "ai_draft_sent"
  | "ai_draft_rejected"
  | "thread_escalated"
  | "thread_resolved"
  | "email_processed"
  | "inbox_connected"
  | "inbox_disconnected"
  | "user_invited"
  | "user_removed"
  | "team_invite_sent"
  | "team_invite_accepted"
  | "team_role_changed"
  | "team_member_removed"
  | "data_export_requested"
  | "account_deletion_requested"
  | "account_deletion_cancelled"
  | "account_deletion_completed"
  | "data_retention_purged"
  | "subscription_required_block"
  | "usage_limit_reached"
  | "billing_portal_opened"
  | "onboarding_completed"
  // Website portal actions (already written elsewhere; listed for reference)
  | "checkout_completed"
  | "subscription_updated"
  | "subscription_canceled"
  | "payment_succeeded"
  | "payment_failed"
  | "trial_expired";

export type AuditEntry = {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  metadata?: Record<string, unknown>;
};

/**
 * Write an audit log entry. Never throws — logs to console on failure since
 * audit writes are typically a side-effect and shouldn't break the main flow.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    // P2.9 — mask PII in metadata before persisting
    const masked: AuditEntry = { ...entry, metadata: maskMetadata(entry.metadata) };
    await dbWriteAuditLog(masked);
  } catch (err) {
    console.error("[audit] write failed:", err, { action: entry.action, organizationId: entry.organizationId });
  }
}
