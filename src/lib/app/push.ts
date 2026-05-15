/**
 * Web Push helpers — server-side only.
 *
 * Sends notifications via the Web Push protocol to subscribed browsers.
 * Uses VAPID for authentication. Keys must be set in env:
 *   - VAPID_PUBLIC_KEY  (also exposed to client as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT     (mailto:something@yourdomain.com)
 *
 * Stale subscriptions (404/410 from push service) are auto-removed from DB.
 */

import webpush from "web-push";
import { db, isDbConnected, pushSubscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

let _configured = false;
function ensureConfigured() {
  if (_configured) return true;
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? "mailto:noreply@mailmind.se";
  if (!pub || !priv) {
    console.warn("[push] VAPID keys not set — push notifications disabled");
    return false;
  }
  webpush.setVapidDetails(subj, pub, priv);
  _configured = true;
  return true;
}

export type PushPayload = {
  /** Notification title shown in the OS */
  title: string;
  /** Body text shown below the title */
  body:  string;
  /** Optional click-through URL — defaults to /app/inbox */
  url?:  string;
  /** Optional tag — same tag collapses notifications */
  tag?:  string;
};

/**
 * Send a push notification to a single user (all their registered devices).
 * Non-fatal — logs and continues on errors.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isDbConnected())  return;
  if (!ensureConfigured()) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  await Promise.all(subs.map(sub => sendToSubscription(sub, payload)));
}

/**
 * Send to all users in an org. Used for new-thread notifications where
 * any team member can pick it up.
 */
export async function sendPushToOrg(organizationId: string, payload: PushPayload): Promise<void> {
  if (!isDbConnected())  return;
  if (!ensureConfigured()) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.organizationId, organizationId));

  if (subs.length === 0) return;

  await Promise.all(subs.map(sub => sendToSubscription(sub, payload)));
}

async function sendToSubscription(
  sub: typeof pushSubscriptions.$inferSelect,
  payload: PushPayload,
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600 } // server holds it for max 1h if browser is offline
    );

    // Touch lastUsedAt — useful for pruning stale subs later
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.id, sub.id));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    // 404 / 410 → subscription is permanently gone, remove from DB
    if (e.statusCode === 404 || e.statusCode === 410) {
      console.info("[push] removing stale subscription", sub.id);
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id))
        .catch(() => {});
    } else {
      console.error("[push] send failed:", e.statusCode, e.message);
    }
  }
}
