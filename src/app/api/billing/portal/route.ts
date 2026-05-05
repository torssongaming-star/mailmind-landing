import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

/**
 * GET /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user
 * and redirects them to Stripe's hosted billing management page.
 *
 * Flow:
 * 1. Get Clerk user
 * 2. Look up stored Stripe customer ID from Clerk publicMetadata
 * 3. If no customer ID yet, create one in Stripe
 * 4. Store the customer ID back in Clerk metadata for future use
 * 5. Create a portal session and redirect
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL));
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Retrieve or create the Stripe customer
    let stripeCustomerId = user.publicMetadata?.stripeCustomerId as string | undefined;

    if (!stripeCustomerId) {
      // First visit to billing — create a Stripe customer
      const customer = await stripe.customers.create({
        email: user.primaryEmailAddress?.emailAddress,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || undefined,
        metadata: {
          clerkUserId: userId,
        },
      });
      stripeCustomerId = customer.id;

      // Persist the customer ID in Clerk's publicMetadata
      // This avoids needing a database in Phase 2
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          stripeCustomerId,
        },
      });
    }

    // Create the Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("[billing/portal] Error:", err);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
