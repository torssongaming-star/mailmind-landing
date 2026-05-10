import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PRICE_IDS } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const plan = body.plan as keyof typeof PRICE_IDS;

    const priceId = PRICE_IDS[plan];
    if (!priceId || priceId === "price_replace_me") {
      return NextResponse.json(
        { error: "Den här planen är inte tillgänglig för tillfället. Kontakta support om problemet kvarstår." },
        { status: 400 }
      );
    }

    // 1. Resolve organization and Stripe Customer ID
    const portalData = await db.getPortalData(userId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stripeCustomerId: any = portalData.org?.stripeCustomerId || undefined;

    if (!stripeCustomerId) {
      // Check if Clerk has it as a fallback
      stripeCustomerId = (user.publicMetadata?.stripeCustomerId as string) || undefined;
    }

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.primaryEmailAddress?.emailAddress,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || undefined,
        metadata: { clerkUserId: userId },
      });
      stripeCustomerId = customer.id;

      // Sync to database
      await db.syncUserAndOrganization({
        clerkUserId: userId,
        email: user.primaryEmailAddress?.emailAddress || "",
        stripeCustomerId: stripeCustomerId || undefined,
      });

      // Update Clerk (secondary cache)
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          stripeCustomerId,
        },
      });
    }

    // Check if user already has an active subscription
    if (portalData.subscription?.status === "active" || portalData.subscription?.status === "trialing") {
      // If they already have a plan, redirect them to the Billing Portal instead
      // of showing an error. This enables "Switch plan" buttons to work.
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      });
      return NextResponse.json({ url: session.url });
    }

    // 2. Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=cancelled`,
      metadata: {
        clerkUserId: userId,
        plan,
      },
      subscription_data: {
        metadata: {
          clerkUserId: userId,
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
