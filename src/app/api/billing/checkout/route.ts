import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PRICE_IDS } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db/queries";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const checkoutSchema = z.object({
  plan:          z.enum(["starter", "team", "business"]),
  billingPeriod: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate-limit per user — protects the Stripe API from a hostile or buggy
    // client hammering checkout (Denial-of-Wallet guard). 5 attempts / minute.
    if (!(await rateLimit(`checkout:${userId}`, RATE_LIMITS.checkout))) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 },
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    const { plan, billingPeriod } = parsed.data;

    const priceId = PRICE_IDS[plan]?.[billingPeriod];

    console.log("[billing/checkout] Request:", { plan, billingPeriod, priceId, availablePlans: Object.keys(PRICE_IDS) });

    if (!priceId || priceId === "price_replace_me") {
      return NextResponse.json(
        { error: `Den här planen (${plan}) är inte tillgänglig för tillfället. Kontakta support om problemet kvarstår.` },
        { status: 400 }
      );
    }

    // 1. Resolve organization and Stripe Customer ID
    const portalData = await db.getPortalData(userId);

    let stripeCustomerId: string | undefined = portalData.org?.stripeCustomerId || undefined;

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

    // Synthetic trials (stripeSubscriptionId starting with "sub_trial_") are
    // DB-only placeholders — not real Stripe subscriptions. Users with a
    // synthetic trial must go through checkout to activate the native Stripe trial.
    const sub = portalData.subscription;
    const hasRealSub = sub != null && !sub.stripeSubscriptionId.startsWith("sub_trial_");

    // Real active/trialing subscription → send to Billing Portal to manage it.
    if (hasRealSub && (sub.status === "active" || sub.status === "trialing")) {
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      });
      return NextResponse.json({ url: session.url });
    }

    // 2. Create Stripe Checkout session.
    // Add a 14-day native trial when the org has no real Stripe subscription yet.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "if_required",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?checkout=cancelled`,
      metadata: {
        clerkUserId: userId,
        plan,
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          clerkUserId: userId,
          plan,
          billingPeriod,
        },
        ...(!hasRealSub && { trial_period_days: 14 }),
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
