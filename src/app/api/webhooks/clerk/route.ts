/**
 * POST /api/webhooks/clerk
 *
 * Handles Clerk user lifecycle events that need to sync to our DB:
 *   user.created  — currently a no-op (we provision in /app/onboarding instead)
 *   user.deleted  — remove the user row + cascade to org if they're the only one
 *   user.updated  — sync email changes
 *   organization.* — Phase 5+ (multi-tenant orgs)
 *
 * Configure in Clerk Dashboard:
 *   Webhooks → Add Endpoint
 *   URL: https://mailmind.se/api/webhooks/clerk
 *   Events: user.created, user.updated, user.deleted
 *   Copy the Signing Secret → set CLERK_WEBHOOK_SECRET in Vercel + .env.local
 *
 * Signature verification uses svix (the library Clerk uses internally).
 * The endpoint must be excluded from Clerk middleware — proxy.ts already
 * permits /api/webhooks/* via its global matcher.
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db, isDbConnected, users, organizations } from "@/lib/db";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

type ClerkEvent =
  | { type: "user.created"; data: { id: string; email_addresses: Array<{ email_address: string }> } }
  | { type: "user.updated"; data: { id: string; email_addresses: Array<{ email_address: string }> } }
  | { type: "user.deleted"; data: { id: string } }
  | { type: string; data: unknown };

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret || secret === "whsec_replace_me") {
    console.warn("[clerk-webhook] CLERK_WEBHOOK_SECRET not configured — skipping verification");
    return NextResponse.json({ received: true, warning: "secret not configured" });
  }

  // Read raw body for signature verification
  const body = await req.text();
  const headers = {
    "svix-id":        req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, headers) as ClerkEvent;
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (!isDbConnected()) {
    return NextResponse.json({ received: true, warning: "DB not connected" });
  }

  try {
    switch (event.type) {
      case "user.deleted": {
        const data = event.data as { id: string };
        const clerkUserId = data.id;
        if (!clerkUserId) break;

        // Find user → look up org → delete user row
        const userRow = await db
          .select()
          .from(users)
          .where(eq(users.clerkUserId, clerkUserId))
          .limit(1)
          .then(r => r[0] ?? null);

        if (!userRow) {
          console.log(`[clerk-webhook] user.deleted: clerkUserId ${clerkUserId} not found in DB`);
          break;
        }

        // Audit before delete (otherwise FK cascade would clear org → no audit visibility)
        if (userRow.organizationId) {
          await writeAuditLog({
            organizationId: userRow.organizationId,
            userId:         null, // user is being deleted; can't reference
            action:         "user_removed",
            metadata:       { clerkUserId, email: userRow.email, source: "clerk_webhook" },
          });
        }

        // Delete the user. If they were the only user in their org and org has no
        // active subscription, also delete the org. Otherwise leave the org for
        // the remaining members (or for billing reconciliation).
        await db.delete(users).where(eq(users.clerkUserId, clerkUserId));

        if (userRow.organizationId) {
          const remaining = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.organizationId, userRow.organizationId))
            .limit(1);

          if (remaining.length === 0) {
            // Cascade-delete the org (which cascades to subs, threads, etc.)
            await db.delete(organizations).where(eq(organizations.id, userRow.organizationId));
          }
        }

        break;
      }

      case "user.updated": {
        const data = event.data as { id: string; email_addresses: Array<{ email_address: string }> };
        const clerkUserId = data.id;
        const email = data.email_addresses?.[0]?.email_address;
        if (!clerkUserId || !email) break;

        await db
          .update(users)
          .set({ email, updatedAt: new Date() })
          .where(eq(users.clerkUserId, clerkUserId));
        break;
      }

      case "user.created":
      default:
        // No action — onboarding flow handles user.created via /app/onboarding
        break;
    }
  } catch (err) {
    console.error(`[clerk-webhook] error processing ${event.type}:`, err);
    return NextResponse.json({ received: true, warning: "processing error" });
  }

  return NextResponse.json({ received: true });
}
