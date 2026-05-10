import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import * as db from "@/lib/db/queries";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 1. Resolve organization and Stripe Customer ID
    const portalData = await db.getPortalData(userId);
    let stripeCustomerId: string | undefined = portalData.org?.stripeCustomerId || undefined;

    if (!stripeCustomerId) {
      // Fallback to Clerk metadata
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

    // 2. Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const error = err as Error & { code?: string; type?: string };
    console.error("[billing/portal] Detailed Error:", {
      message: error.message,
      code: error.code,
      type: error.type,
    });
    return NextResponse.json(
      { error: error.message || "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
