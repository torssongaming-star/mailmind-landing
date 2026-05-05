import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user
 * and returns the portal URL as JSON. The client is responsible for
 * redirecting to the returned URL.
 *
 * Flow:
 * 1. Verify Clerk authentication
 * 2. Resolve the Stripe customer ID for this user
 * 3. Create a Stripe Billing Portal session
 * 4. Return { url } as JSON
 */
export async function POST() {
  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Resolve Stripe customer ID ──────────────────────────────────────────
    //
    // TODO (Phase 3): Replace this Clerk-metadata lookup with a real database
    //   query once the `users` table is in place:
    //
    //   const dbUser = await db.query.users.findFirst({
    //     where: eq(users.clerkId, userId),
    //     columns: { stripeCustomerId: true },
    //   });
    //   stripeCustomerId = dbUser?.stripeCustomerId;
    //
    // TODO (Phase 3): Link Clerk organisation ID to Stripe customer so that
    //   team billing works correctly across multiple seats.
    //
    let stripeCustomerId = user.publicMetadata?.stripeCustomerId as string | undefined;

    if (!stripeCustomerId) {
      // No Stripe customer yet — create one and persist the ID so future
      // calls skip this step.
      //
      // TODO (Phase 3): Write the new customer ID to the database instead of
      //   (or in addition to) Clerk metadata.
      const customer = await stripe.customers.create({
        email: user.primaryEmailAddress?.emailAddress,
        name:
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || undefined,
        metadata: { clerkUserId: userId },
      });
      stripeCustomerId = customer.id;

      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          stripeCustomerId,
        },
      });
    }

    // ── Create portal session ───────────────────────────────────────────────
    //
    // TODO (Phase 3): Add Stripe webhook handling to keep subscription status
    //   in sync with the database after the customer makes changes in the
    //   portal (plan change, cancellation, payment method update).
    //   Register these events in Stripe Dashboard → Webhooks:
    //     - customer.subscription.updated
    //     - customer.subscription.deleted
    //     - invoice.payment_failed
    //
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    // Return the portal URL as JSON — the client handles the redirect.
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] Error:", err);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
