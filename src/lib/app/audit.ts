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

export type AuditAction =
  // App actions (Mailmind email triage)
  | "ai_draft_generated"
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
  | "subscription_required_block"
  | "usage_limit_reached"
  | "billing_portal_opened"
  | "onboarding_completed"
  // Website portal actions (already written elsewhere; listed for reference)
  | "checkout_completed"
  | "subscription_updated"
  | "subscription_canceled"
  | "payment_succeeded"
  | "payment_failed";

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
    await dbWriteAuditLog(entry);
  } catch (err) {
    console.error("[audit] write failed:", err, entry);
  }
}
