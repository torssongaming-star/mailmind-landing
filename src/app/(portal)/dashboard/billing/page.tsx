import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { CheckoutButton } from "@/components/portal/CheckoutButton";
import { ManageBillingButton } from "@/components/portal/ManageBillingButton";
import { PLANS } from "@/lib/stripe";
import { CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";

function formatDate(unixTimestamp: number | undefined): string {
  if (!unixTimestamp) return "—";
  return new Date(unixTimestamp * 1000).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string | undefined }) {
  const map: Record<string, { label: string; className: string }> = {
    active:     { label: "Active",     className: "text-green-400 bg-green-500/10 border-green-500/20" },
    trialing:   { label: "Trial",      className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    past_due:   { label: "Past due",   className: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    cancelled:  { label: "Cancelled",  className: "text-red-400 bg-red-500/10 border-red-500/20" },
    incomplete: { label: "Incomplete", className: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  };
  const s = map[status ?? ""] ?? { label: "No plan", className: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.className}`}>
      {s.label}
    </span>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { userId } = await auth();
  const user = await currentUser();
  const params = await searchParams;

  if (!userId || !user) return null;

  // Read subscription state from Clerk publicMetadata (synced by Stripe webhook)
  const meta = user.publicMetadata as {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    plan?: string;
    currentPeriodEnd?: number;
  };

  const currentPlanKey = meta.plan ?? null;
  const currentPlan = currentPlanKey ? PLANS[currentPlanKey as keyof typeof PLANS] : null;
  const status = meta.subscriptionStatus;
  const periodEnd = meta.currentPeriodEnd;
  const hasSubscription = !!meta.stripeSubscriptionId;

  const checkoutSuccess = params.checkout === "success";
  const checkoutCancelled = params.checkout === "cancelled";

  return (
    <>
      <DashboardHeader title="Billing" description="Manage your subscription and payment details" />

      <main className="flex-1 p-6 space-y-6 max-w-3xl">

        {/* Checkout feedback banners */}
        {checkoutSuccess && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            <CheckCircle2 size={16} className="shrink-0" />
            Subscription activated! Your plan is now live.
          </div>
        )}
        {checkoutCancelled && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Checkout was cancelled. Your plan has not changed.
          </div>
        )}
        {status === "past_due" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Payment failed. Please update your payment method to keep your account active.
          </div>
        )}

        {/* Subscription card */}
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Subscription</h2>
              <p className="text-xs text-muted-foreground">Your current Mailmind plan</p>
            </div>
          </div>

          <div className="space-y-0 mb-8 divide-y divide-white/5">
            {[
              ["Plan",             currentPlan?.name ?? "No active plan"],
              ["Status",          <StatusBadge key="status" status={status} />],
              ["Price",           currentPlan ? `${currentPlan.price}/month` : "—"],
              ["Renews",          periodEnd ? formatDate(periodEnd) : "—"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between items-center py-3.5">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm text-white font-medium">{value}</span>
              </div>
            ))}
          </div>

          {hasSubscription ? (
            <ManageBillingButton />
          ) : (
            <p className="text-sm text-muted-foreground">
              No active subscription. Choose a plan below to get started.
            </p>
          )}
        </div>

        {/* Plan comparison */}
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6">
          <h3 className="text-sm font-semibold text-white mb-5">
            {hasSubscription ? "Switch plan" : "Choose a plan"}
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => {
              const isCurrent = currentPlanKey === key;
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 flex flex-col ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{plan.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-white mb-1">
                    {plan.price}
                    <span className="text-xs text-muted-foreground font-normal">/mo</span>
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                    <li>{plan.draftsLimit.toLocaleString()} AI drafts/mo</li>
                    <li>{plan.inboxLimit} inbox{plan.inboxLimit > 1 ? "es" : ""}</li>
                    <li>{plan.seatLimit} seats</li>
                  </ul>
                  <div className="mt-auto">
                    <CheckoutButton plan={key} label={`Subscribe to ${plan.name}`} isCurrent={isCurrent} />
                  </div>
                </div>
              );
            })}
          </div>
          {hasSubscription && (
            <p className="text-xs text-muted-foreground mt-4">
              Plan changes take effect at the next billing cycle. Managed via Stripe.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Billing questions?{" "}
          <a href="mailto:billing@mailmind.io" className="text-primary hover:underline">
            billing@mailmind.io
          </a>
        </p>
      </main>
    </>
  );
}
