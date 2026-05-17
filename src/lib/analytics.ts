/**
 * Server-side analytics helper — wraps PostHog Node SDK.
 *
 * GDPR: All events route through PostHog Cloud EU (eu.i.posthog.com).
 * No PII in event properties — only IDs (clerkUserId, organizationId).
 * Caller decides distinctId; for org-level events use orgId as distinctId.
 *
 * Always non-blocking and non-fatal: analytics failure must never break a request.
 * In serverless (Vercel) we flush after every call (flushAt: 1, flushInterval: 0).
 *
 * Setup:
 *   POSTHOG_KEY             = your PostHog project API key
 *   NEXT_PUBLIC_POSTHOG_HOST = https://eu.i.posthog.com  (EU endpoint)
 */

import { PostHog } from "posthog-node";

let _ph: PostHog | null = null;

function client(): PostHog | null {
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!_ph) {
    _ph = new PostHog(key, {
      host:          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt:       1,  // send every event immediately in serverless
      flushInterval: 0,  // disable interval-based flushing
    });
  }
  return _ph;
}

export type TrackPayload = {
  /** Clerk user ID or org ID for anonymous/org-level events. */
  distinctId:  string;
  event:       string;
  properties?: Record<string, unknown>;
  /** PostHog group keys, e.g. { organization: orgId } */
  groups?:     Record<string, string>;
};

/** Fire an analytics event. Never throws. */
export async function trackEvent(payload: TrackPayload): Promise<void> {
  try {
    const ph = client();
    if (!ph) return;
    ph.capture({
      distinctId: payload.distinctId,
      event:      payload.event,
      properties: {
        ...payload.properties,
        ...(payload.groups ? { $groups: payload.groups } : {}),
      },
    });
    await ph.flush();
  } catch {
    // Analytics must never break a request
  }
}

/**
 * Identify a user (create/update PostHog Person).
 * Call once after signup — do NOT include email or name (GDPR).
 */
export async function identifyUser(
  clerkUserId: string,
  properties: { orgId?: string; plan?: string },
): Promise<void> {
  try {
    const ph = client();
    if (!ph) return;
    ph.identify({
      distinctId: clerkUserId,
      properties: {
        org_id: properties.orgId,
        plan:   properties.plan,
      },
    });
    await ph.flush();
  } catch {}
}

/**
 * Set group properties for an organization.
 * Call after signup and after plan changes.
 */
export async function groupOrg(
  orgId:      string,
  properties: { plan?: string; status?: string; createdAt?: string },
): Promise<void> {
  try {
    const ph = client();
    if (!ph) return;
    ph.groupIdentify({
      groupType: "organization",
      groupKey:  orgId,
      properties: {
        plan:       properties.plan,
        status:     properties.status,
        created_at: properties.createdAt,
      },
    });
    await ph.flush();
  } catch {}
}
