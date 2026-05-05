import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events and syncs subscription state
 * back to Clerk's user publicMetadata.
 *
 * IMPORTANT: This route must receive the raw request body for
 * signature verification — do NOT use req.json() before verification.
 *
 * Handled events:
 * - checkout.session.completed        → subscription activated
 * - customer.subscription.updated     → plan changed / renewed
 * - customer.subscription.deleted     → cancelled
 * - invoice.payment_failed            → payment issue flag
 */
export const runtime = "nodejs"; // stripe SDK requires Node.js runtime

export async function POST(req: NextRequest) {
  const body = await req.text(); // raw body required for signature verification
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET === "whsec_replace_me") {
    console.warn("[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured — skipping verification");
    return NextResponse.json({ received: true });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook/stripe] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  const client = await clerkClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const clerkUserId = session.metadata?.clerkUserId;
        const plan = session.metadata?.plan;

        if (!clerkUserId) break;

        const user = await client.users.getUser(clerkUserId);
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
            plan: plan ?? "starter",
          },
        });

        console.log(`[webhook/stripe] checkout.session.completed → user ${clerkUserId} subscribed to ${plan}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const clerkUserId = subscription.metadata?.clerkUserId;

        if (!clerkUserId) break;

        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId ?? "") ?? "starter";

        // current_period_end exists at runtime; type cast for SDK version differences
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const periodEnd = (subscription as any).current_period_end as number | undefined;

        const user = await client.users.getUser(clerkUserId);
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            plan,
            currentPeriodEnd: periodEnd,
          },
        });

        console.log(`[webhook/stripe] subscription.updated → user ${clerkUserId} plan=${plan} status=${subscription.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const clerkUserId = subscription.metadata?.clerkUserId;

        if (!clerkUserId) break;

        const user = await client.users.getUser(clerkUserId);
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
            subscriptionStatus: "cancelled",
            plan: null,
          },
        });

        console.log(`[webhook/stripe] subscription.deleted → user ${clerkUserId} cancelled`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        // Find clerk user by stripe customer ID
        const customers = await stripe.customers.list({ limit: 1 });
        const customer = customers.data.find((c) => c.id === customerId);
        const clerkUserId = customer?.metadata?.clerkUserId;

        if (!clerkUserId) break;

        const user = await client.users.getUser(clerkUserId);
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
            subscriptionStatus: "past_due",
          },
        });

        console.warn(`[webhook/stripe] invoice.payment_failed → user ${clerkUserId} is past_due`);
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt without processing
        break;
    }
  } catch (err) {
    console.error(`[webhook/stripe] Error processing event ${event.type}:`, err);
    // Return 200 anyway — Stripe retries on non-2xx, which can cause loops
    return NextResponse.json({ received: true, warning: "Processing error" });
  }

  return NextResponse.json({ received: true });
}
