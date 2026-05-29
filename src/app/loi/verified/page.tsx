/**
 * /loi/verified — visas efter att användaren klickat bekräftelselänken i mejlet.
 *
 * Energisk, varm välkomstsida som skapar en känsla av att ha kommit med i
 * något viktigt. Ingen redirectar tillbaka till formulärsidan.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Välkommen till framtiden — Mailmind",
  description:
    "Din plats är säkrad. Mailmind hör av sig personligt inför lansering.",
};

export default function LoiVerifiedPage() {
  return (
    <div className="relative min-h-screen bg-[hsl(var(--surface-base))] text-white antialiased flex flex-col">
      {/* Background glows */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse 1000px 700px at 50% -5%, hsl(189 94% 43% / 0.14), transparent 55%), " +
            "radial-gradient(ellipse 700px 500px at 85% 105%, hsl(262 83% 58% / 0.09), transparent 50%), " +
            "radial-gradient(ellipse 400px 400px at 10% 80%, hsl(189 94% 43% / 0.05), transparent 60%)",
        }}
        aria-hidden
      />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 md:py-28">
        <div className="max-w-lg w-full text-center space-y-7">

          {/* ── Checkmark badge ───────────────────────────────────────── */}
          <div className="flex justify-center mb-2">
            <div
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center border border-primary/40 bg-primary/[0.07]"
              style={{ boxShadow: "0 0 48px hsl(189 94% 43% / 0.22), 0 0 12px hsl(189 94% 43% / 0.12) inset" }}
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
                aria-hidden
              >
                <path d="M5 12l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* ── Eyebrow ───────────────────────────────────────────────── */}
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
            Bekräftad · Pre-launch
          </p>

          {/* ── Headline ──────────────────────────────────────────────── */}
          <h1 className="text-[40px] md:text-[54px] font-bold tracking-[-0.03em] text-white leading-[1.05]">
            Välkommen till<br />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, hsl(189 94% 65%), hsl(262 83% 75%))",
              }}
            >
              framtiden.
            </span>
          </h1>

          {/* ── Sub-headline ──────────────────────────────────────────── */}
          <p className="text-[17px] text-white/75 leading-relaxed max-w-md mx-auto">
            Din mejladress är bekräftad och din plats är säkrad. Vi hör av oss
            personligt när Mailmind drar igång — du är en av de första.
          </p>

          {/* ── What's next ───────────────────────────────────────────── */}
          <div className="grid gap-2.5 text-left mt-2">
            {[
              {
                icon: "✉️",
                title: "Personlig kontakt inför lansering",
                body:  "Vi hör av oss direkt — inte med ett massmejl.",
              },
              {
                icon: "🎯",
                title: "Prioriterad demo och onboarding",
                body:  "Du hoppar över kön och får assisterad onboarding från dag ett.",
              },
              {
                icon: "💬",
                title: "Påverka produkten",
                body:  "Dina synpunkter kan forma Mailmind innan lansering.",
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5"
              >
                <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>
                  {icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white/90 leading-snug">
                    {title}
                  </p>
                  <p className="text-xs text-white/55 leading-relaxed mt-0.5">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Manifesto strip ───────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/[0.06] px-6 py-5 mt-2"
            style={{
              background:
                "linear-gradient(135deg, hsl(189 94% 43% / 0.06) 0%, hsl(262 83% 58% / 0.04) 100%)",
            }}
          >
            <p className="text-sm text-white/65 leading-relaxed italic">
              &ldquo;Framtidens arbetsdag byggs nu. Snart drar vi igång — och du är
              med från första dag.&rdquo;
            </p>
            <p className="text-[11px] text-primary/70 font-medium mt-2 tracking-wide">
              — Teamet på Mailmind
            </p>
          </div>

          {/* ── CTA ───────────────────────────────────────────────────── */}
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Tillbaka till mailmind.se
            </Link>
          </div>

        </div>
      </main>

      {/* Subtle footer */}
      <footer className="text-center pb-8">
        <p className="text-[11px] text-white/25">
          Frågor?{" "}
          <a
            href="mailto:hello@mailmind.se"
            className="hover:text-white/60 transition-colors underline underline-offset-2"
          >
            hello@mailmind.se
          </a>
        </p>
      </footer>
    </div>
  );
}
