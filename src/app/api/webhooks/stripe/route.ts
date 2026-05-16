import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import * as db from "@/lib/db/queries";
import { PLANS } from "@/lib/plans";
import Stripe from "stripe";
import { Subscription as DbSubscription } from "@/lib/db/schema";

/**
 * Map Stripe subscription status → our DB enum.
 * Stripe has `unpaid`, `incomplete_expired`, and uses American spelling
 * (`canceled`); our DB uses `cancelled` and a smaller value set.
 */
function mapStripeStatus(s: Stripe.Subscription.Status): DbSubscription["status"] {
  switch (s) {
    case "active":             return "active";
    case "trialing":           return "trialing";
    case "past_due":           return "past_due";
    case "canceled":           return "cancelled";
    case "incomplete":         return "incomplete";
    case "incomplete_expired": return "cancelled"; // expired = effectively cancelled
    case "unpaid":             return "past_due";  // closest match
    case "paused":             return "paused";
    default:                   return "cancelled"; // safe fallback
  }
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET === "whsec_replace_me") {
    // Hard-fail: a missing/placeholder secret means we can't verify, so we
    // must reject. Previously we silently 200'd which left the endpoint
    // open to forged checkout-completed events that grant subscriptions.
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
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
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;
        const plan = (session.metadata?.plan as keyof typeof PLANS) || "starter";

        if (!clerkUserId) {
          console.error("[webhook/stripe] checkout.session.completed missing clerkUserId");
          break;
        }

        const clerkUser = await client.users.getUser(clerkUserId);
        const email = clerkUser.primaryEmailAddress?.emailAddress || "";

        // 1. Ensure user and org exist in DB
        const syncResult = await db.syncUserAndOrganization({
          clerkUserId,
          email,
          stripeCustomerId: session.customer as string,
        });

        if (!syncResult) break;

        // 2. Resolve subscription details
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;

        // 3. Sync subscription to DB
        await db.upsertSubscription({
          organizationId: syncResult.organizationId,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: session.customer as string,
          plan,
          status: mapStripeStatus(subscription.status),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        });

        // 4. Audit Log
        await db.writeAuditLog({
          organizationId: syncResult.organizationId,
          userId: syncResult.user.id,
          action: "checkout_completed",
          metadata: { plan, stripeSubscriptionId: subscriptionId },
        });

        // 5. Update Clerk (as cache)
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active",
            plan,
          },
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;
        const orgId = await db.getOrgIdByStripeCustomer(stripeCustomerId);

        if (!orgId) {
          console.warn(`[webhook/stripe] No organization found for customer ${stripeCustomerId}`);
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId ?? "") ?? "starter";

        await db.upsertSubscription({
          organizationId: orgId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId,
          plan,
          status: mapStripeStatus(subscription.status),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        });

        await db.writeAuditLog({
          organizationId: orgId,
          action: "subscription_updated",
          metadata: { 
            status: subscription.status, 
            plan,
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = await db.getOrgIdByStripeCustomer(subscription.customer as string);

        if (orgId) {
          await db.upsertSubscription({
            organizationId: orgId,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            plan: "starter", // Fallback plan
            status: "cancelled",
            currentPeriodEnd: new Date(),
            cancelAtPeriodEnd: false,
          });

          await db.writeAuditLog({
            organizationId: orgId,
            action: "subscription_canceled",
            metadata: { stripeSubscriptionId: subscription.id },
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const orgId = await db.getOrgIdByStripeCustomer(invoice.customer as string);
        if (orgId) {
          await db.writeAuditLog({
            organizationId: orgId,
            action: "payment_succeeded",
            metadata: { invoiceId: invoice.id, amount: invoice.amount_paid },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const orgId = await db.getOrgIdByStripeCustomer(invoice.customer as string);
        if (orgId) {
          await db.writeAuditLog({
            organizationId: orgId,
            action: "payment_failed",
            metadata: { invoiceId: invoice.id, amount: invoice.amount_due },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook/stripe] Error processing event ${event.type}:`, err);
    return NextResponse.json({ received: true, warning: "Processing error" });
  }

  return NextResponse.json({ received: true });
}
