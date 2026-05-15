/**
 * POST   /api/app/push/subscribe   — register or refresh a push subscription
 * DELETE /api/app/push/subscribe   — unsubscribe (by endpoint)
 *
 * Client flow:
 *   1. Request Notification.permission
 *   2. swReg.pushManager.subscribe({ applicationServerKey: <VAPID_PUBLIC_KEY> })
 *   3. POST the PushSubscription JSON here
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { db, isDbConnected, pushSubscriptions } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

const SubscribeBody = z.object({
  endpoint:  z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
  userAgent: z.string().max(255).optional(),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: NextRequest) {
  if (!isDbConnected()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = SubscribeBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = parsed.data;

  // Upsert by endpoint (unique). If the same browser re-subscribes we just
  // refresh the user/org binding + keys (which can rotate).
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1)
    .then(r => r[0] ?? null);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId:         account.user.id,
        organizationId: account.organization.id,
        p256dh:         keys.p256dh,
        auth:           keys.auth,
        userAgent:      userAgent ?? null,
        lastUsedAt:     new Date(),
      })
      .where(eq(pushSubscriptions.id, existing.id));
  } else {
    await db.insert(pushSubscriptions).values({
      userId:         account.user.id,
      organizationId: account.organization.id,
      endpoint,
      p256dh:         keys.p256dh,
      auth:           keys.auth,
      userAgent:      userAgent ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isDbConnected()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = UnsubscribeBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Only allow deleting your own subscription
  await db
    .delete(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      eq(pushSubscriptions.userId,   account.user.id),
    ));

  return NextResponse.json({ ok: true });
}
