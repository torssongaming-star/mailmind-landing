"use client";

import { ClerkProvider } from "@clerk/nextjs";

/**
 * Client-side provider wrapper.
 * Wraps the app in ClerkProvider with custom appearance variables
 * matching the Mailmind dark glass design system.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#06b6d4",         // cyan
          colorBackground: "#0a1628",      // slightly lighter than before — improves card/page contrast
          colorInputBackground: "#111d35", // input fields: clearly distinct from card bg
          colorInputText: "#f1f5f9",       // slate-100 — crisp readable text in inputs
          colorText: "#f1f5f9",            // primary text: bright white-ish
          colorTextSecondary: "#cbd5e1",   // slate-300 — was slate-400, now much more readable
          colorNeutral: "#334155",         // slate-700 — dividers, borders
          borderRadius: "0.75rem",
          fontFamily: "Inter, sans-serif",
        },
        elements: {
          // Card: slightly brighter bg + stronger border so it reads against the dark page
          card: "bg-[#0d1f3c] border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.6),0_0_30px_rgba(6,182,212,0.05)]",

          // Header
          headerTitle: "text-white font-bold tracking-tight",
          headerSubtitle: "text-slate-300",          // was slate-400 — now clearly readable

          // Social auth buttons — brighter border + explicit bg so Apple icon is visible
          socialButtonsBlockButton:
            "bg-white/8 border border-white/20 hover:bg-white/15 hover:border-white/30 text-white transition-colors",
          socialButtonsBlockButtonText: "text-slate-100 font-medium",
          socialButtonsBlockButtonArrow: "text-slate-300",

          // "or" divider
          dividerLine: "bg-white/15",
          dividerText: "text-slate-400",             // was slate-500 — more visible

          // Form fields
          formFieldLabel: "text-slate-200 text-sm font-medium", // was slate-300
          formFieldInput:
            "bg-[#111d35] border border-white/15 text-white placeholder:text-slate-500 " +
            "focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30",

          // Continue / primary button
          formButtonPrimary:
            "bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-[#030614] font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)]",

          // Footer
          footerAction: "border-t border-white/10 bg-white/[0.02]",
          footerActionText: "text-slate-300",        // "Don't have an account?" — was near invisible
          footerActionLink: "text-cyan-400 hover:text-cyan-300 font-medium",

          // Misc
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-cyan-400",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
