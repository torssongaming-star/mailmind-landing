import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { CheckoutButton } from "@/components/portal/CheckoutButton";
import { ManageBillingButton } from "@/components/portal/ManageBillingButton";
import { PLANS } from "@/lib/plans";
import { getPortalData } from "@/lib/db/queries";
import { CreditCard, AlertTriangle, CheckCircle2, Database } from "lucide-react";

import { siteConfig } from "@/config/site";

function formatDate(date: Date | string | number | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string | undefined }) {
  const map: Record<string, { label: string; className: string }> = {
    active:     { label: "Aktiv",        className: "text-green-400 bg-green-500/10 border-green-500/20" },
    trialing:   { label: "Provperiod",   className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    past_due:   { label: "Förfallen",    className: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    cancelled:  { label: "Avslutad",     className: "text-red-400 bg-red-500/10 border-red-500/20" },
    incomplete: { label: "Ofullständig", className: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  };
  const s = map[status ?? ""] ?? { label: "Ingen plan", className: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
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

  // Fetch portal data (returns mock if DB not connected)
  const { subscription, isMock } = await getPortalData(userId);

  const currentPlanKey = subscription?.plan ?? null;
  const currentPlan = currentPlanKey ? PLANS[currentPlanKey as keyof typeof PLANS] : null;
  const status = subscription?.status;
  const periodEnd = subscription?.currentPeriodEnd;
  const hasSubscription = !!subscription?.stripeSubscriptionId;

  const checkoutSuccess = params.checkout === "success";
  const checkoutCancelled = params.checkout === "cancelled";

  return (
    <>
      <DashboardHeader title="Fakturering" description="Hantera ditt abonnemang och betalningsuppgifter" />

      <main className="flex-1 p-6 space-y-6 max-w-3xl">

        {/* Mock/Preview Banner */}
        {isMock && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <Database size={16} className="shrink-0" />
            <div>
              <p className="font-semibold">Förhandsvisning</p>
              <p className="text-xs opacity-80 mt-0.5">Visar testdata. Anslut din databas för att se riktig Stripe-data.</p>
            </div>
          </div>
        )}

        {/* Checkout feedback banners */}
        {checkoutSuccess && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            <CheckCircle2 size={16} className="shrink-0" />
            Abonnemang aktiverat! Din plan är nu aktiv.
          </div>
        )}
        {checkoutCancelled && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Kassan avbröts. Din plan har inte ändrats.
          </div>
        )}
        {status === "past_due" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Betalning misslyckades. Uppdatera din betalningsmetod för att hålla kontot aktivt.
          </div>
        )}

        {/* Subscription card */}
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Abonnemang</h2>
              <p className="text-xs text-muted-foreground">Din nuvarande {siteConfig.siteName}-plan</p>
            </div>
          </div>

          <div className="space-y-0 mb-8 divide-y divide-white/5">
            {[
              ["Plan",        currentPlan?.name ?? "Ingen aktiv plan"],
              ["Status",      <StatusBadge key="status" status={status} />],
              ["Pris",        currentPlan ? `${currentPlan.price}/månad` : "—"],
              ["Förnyas",     periodEnd ? formatDate(periodEnd) : "—"],
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
              Inget aktivt abonnemang. Välj en plan nedan för att komma igång.
            </p>
          )}
        </div>

        {/* Plan comparison */}
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-6">
          <h3 className="text-sm font-semibold text-white mb-5">
            {hasSubscription ? "Byt plan" : "Välj en plan"}
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
                        Aktiv
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-white mb-1">
                    {plan.price}
                    <span className="text-xs text-muted-foreground font-normal">/mo</span>
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                    <li>{plan.draftsLimit.toLocaleString()} AI-utkast/mån</li>
                    <li>{plan.inboxLimit} inkorg{plan.inboxLimit > 1 ? "ar" : ""}</li>
                    <li>{plan.seatLimit} platser</li>
                  </ul>
                  <div className="mt-auto">
                    {key === "enterprise" ? (
                      <a
                        href={`mailto:${siteConfig.supportEmail}?subject=Enterprise Plan Inquiry`}
                        className="mt-3 block w-full py-2 rounded-lg text-xs font-semibold text-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-[0.98]"
                      >
                        Kontakta sälj
                      </a>
                    ) : (
                      <CheckoutButton plan={key} label={`Välj ${plan.name}`} isCurrent={isCurrent} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {hasSubscription && (
            <p className="text-xs text-muted-foreground mt-4">
              Uppgraderingar träder i kraft omedelbart. Nedgraderingar börjar gälla i nästa faktureringsperiod.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Faktureringsfrågor?{" "}
          <a href={`mailto:${siteConfig.billingEmail}`} className="text-primary hover:underline">
            {siteConfig.billingEmail}
          </a>
        </p>
      </main>
    </>
  );
}
