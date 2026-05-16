import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mailmind — AI för svensk kundsupport",
  description: "Triagera, kategorisera och svara på kundmejl med AI. Säkert, GDPR-anpassat, byggt i Sverige.",
};

/**
 * /v2 — preview-version av landing-sidan med nytt design system.
 *
 * Skiljer sig från huvudsajten:
 *   - Ingen AnimatedBackground (partiklar/orbs) — bara subtil radial gradient
 *   - HSL-tokens (samma som /app)
 *   - Färre sektioner (7 vs 12)
 *   - Mindre färgaccenter (cyan-only)
 *   - Premium-minimal typografi
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[hsl(var(--surface-base))] text-white antialiased">
      {/* Subtle radial backdrop — single layer, no animation */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse 1200px 800px at 50% -10%, hsl(189 94% 43% / 0.12), transparent 60%), " +
            "radial-gradient(ellipse 800px 600px at 85% 100%, hsl(262 83% 58% / 0.06), transparent 50%)",
        }}
        aria-hidden
      />
      {/* Subtle noise for texture */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />
      {children}
    </div>
  );
}
