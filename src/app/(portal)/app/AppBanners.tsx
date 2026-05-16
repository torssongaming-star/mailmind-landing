/**
 * AppBanners — conversion-focused banners shown across the app.
 *
 * Renders the right banner(s) based on the user's account state:
 *   - Trial countdown when subscription.status === "trialing"
 *   - Past-due warning when status === "past_due"
 *   - AI draft usage warning at >= 80% of monthly limit
 *   - Upgrade CTA when limits are reached
 *
 * Server component — no client interaction, no dismiss state. These are
 * important enough that they should always be visible.
 */

import Link from "next/link";
import { Clock, AlertTriangle, TrendingUp, CreditCard } from "lucide-react";
import type { AccountSnapshot } from "@/lib/app/entitlements";

export function AppBanners({ account }: { account: AccountSnapshot }) {
  const { subscription, entitlements, usage, organization } = account;

  // ── Account deletion pending (highest priority — overrides everything) ─
  if (organization?.deletionRequestedAt) {
    const requested = new Date(organization.deletionRequestedAt);
    const purgeAt   = new Date(requested.getTime() + 30 * 24 * 3600 * 1000);
    const daysLeft  = Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 3600 * 1000)));
    return (
      <Banner
        tone="red"
        icon={AlertTriangle}
        title={`Kontot raderas om ${daysLeft} dag${daysLeft !== 1 ? "ar" : ""}`}
        body="All data raderas permanent när grace-perioden tar slut. Klicka för att ångra."
        cta={{ href: "/app/settings/account", label: "Ångra radering →" }}
      />
    );
  }

  // ── No subscription at all ────────────────────────────────────────────
  if (!subscription) {
    return (
      <Banner
        tone="amber"
        icon={CreditCard}
        title="Inget abonnemang aktiverat"
        body="Välj en plan för att börja använda Mailmind."
        cta={{ href: "/dashboard/billing", label: "Välj plan →" }}
      />
    );
  }

  // ── Past due (read-only mode) ─────────────────────────────────────────
  if (subscription.status === "past_due") {
    return (
      <Banner
        tone="red"
        icon={AlertTriangle}
        title="Betalning misslyckades"
        body="Vi kunde inte dra din betalning. AI-utkast är pausade tills du uppdaterar betalmetoden."
        cta={{ href: "/dashboard/billing", label: "Uppdatera kort →" }}
      />
    );
  }

  // ── Cancelled / paused (blocking) ─────────────────────────────────────
  if (subscription.status === "cancelled" || subscription.status === "paused") {
    return (
      <Banner
        tone="red"
        icon={AlertTriangle}
        title={subscription.status === "paused" ? "Konto pausat" : "Abonnemang avslutat"}
        body="Återaktivera för att fortsätta använda Mailmind."
        cta={{ href: "/dashboard/billing", label: "Återaktivera →" }}
      />
    );
  }

  const banners: React.ReactNode[] = [];

  // ── Trial countdown ───────────────────────────────────────────────────
  if (subscription.status === "trialing") {
    const msPerDay = 24 * 60 * 60 * 1000;
    const trialEnd = new Date(subscription.currentPeriodEnd);
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / msPerDay));

    const tone: BannerTone =
      daysLeft <= 3 ? "amber" :
      daysLeft <= 7 ? "primary" : "primary";

    const title =
      daysLeft === 0 ? "Provperioden går ut idag" :
      daysLeft === 1 ? "1 dag kvar av provperioden" :
      `${daysLeft} dagar kvar av din provperiod`;

    const body =
      daysLeft <= 3
        ? "Lägg till en betalmetod för att inte tappa åtkomst."
        : "Du provkör Mailmind kostnadsfritt. Lägg till en betalmetod när du vill — vi drar inget förrän provperioden tar slut.";

    banners.push(
      <Banner
        key="trial"
        tone={tone}
        icon={Clock}
        title={title}
        body={body}
        cta={{ href: "/dashboard/billing", label: daysLeft <= 3 ? "Lägg till kort →" : "Hantera abonnemang →" }}
      />
    );
  }

  // ── Usage warning (>= 80% of monthly AI drafts) ───────────────────────
  if (subscription.status === "active" || subscription.status === "trialing") {
    const used  = usage?.aiDraftsUsed ?? 0;
    const limit = entitlements?.maxAiDraftsPerMonth ?? 0;
    if (limit > 0) {
      const pct = used / limit;
      if (pct >= 1) {
        banners.push(
          <Banner
            key="usage"
            tone="red"
            icon={AlertTriangle}
            title="AI-kvot för månaden är slut"
            body={`Du har använt alla ${limit} AI-utkast den här månaden. Uppgradera för att fortsätta generera automatiska svar.`}
            cta={{ href: "/dashboard/billing", label: "Uppgradera →" }}
          />
        );
      } else if (pct >= 0.8) {
        const pctRounded = Math.round(pct * 100);
        banners.push(
          <Banner
            key="usage"
            tone="amber"
            icon={TrendingUp}
            title={`${pctRounded}% av din AI-kvot använd`}
            body={`Du har använt ${used} av ${limit} AI-utkast den här månaden. Uppgradera för fler.`}
            cta={{ href: "/dashboard/billing", label: "Se planer →" }}
          />
        );
      }
    }
  }

  if (banners.length === 0) return null;
  return <div className="space-y-3">{banners}</div>;
}

// ── Banner primitive ──────────────────────────────────────────────────────────

type BannerTone = "primary" | "amber" | "red";

const TONE: Record<BannerTone, { border: string; bg: string; iconColor: string; titleColor: string; btnBg: string; btnText: string }> = {
  primary: {
    border:     "border-primary/25",
    bg:         "bg-primary/[0.04]",
    iconColor:  "text-primary",
    titleColor: "text-white",
    btnBg:      "bg-primary hover:bg-cyan-300",
    btnText:    "text-[#030614]",
  },
  amber: {
    border:     "border-amber-500/25",
    bg:         "bg-amber-500/[0.04]",
    iconColor:  "text-amber-400",
    titleColor: "text-white",
    btnBg:      "bg-amber-500 hover:bg-amber-400",
    btnText:    "text-[#030614]",
  },
  red: {
    border:     "border-red-500/30",
    bg:         "bg-red-500/[0.05]",
    iconColor:  "text-red-400",
    titleColor: "text-white",
    btnBg:      "bg-red-500 hover:bg-red-400",
    btnText:    "text-white",
  },
};

function Banner({
  tone, icon: Icon, title, body, cta,
}: {
  tone: BannerTone;
  icon: React.ElementType;
  title: string;
  body:  string;
  cta?:  { href: string; label: string };
}) {
  const s = TONE[tone];
  return (
    <div className={`flex items-start gap-4 rounded-2xl border ${s.border} ${s.bg} px-5 py-4 backdrop-blur-sm`}>
      <div className={`shrink-0 ${s.iconColor} mt-0.5`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${s.titleColor}`}>{title}</p>
        <p className="text-xs text-white/55 leading-relaxed mt-0.5">{body}</p>
      </div>
      {cta && (
        <Link
          href={cta.href}
          className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${s.btnBg} ${s.btnText}`}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
