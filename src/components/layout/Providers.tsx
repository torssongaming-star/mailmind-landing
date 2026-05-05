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
          colorPrimary: "#06b6d4",        // cyan — matches --primary
          colorBackground: "#030614",     // deep navy
          colorInputBackground: "#050B1C",
          colorInputText: "#f8fafc",
          colorText: "#f8fafc",
          colorTextSecondary: "#94a3b8",
          colorNeutral: "#1e293b",
          borderRadius: "0.75rem",
          fontFamily: "Inter, sans-serif",
        },
        elements: {
          card: "bg-[#050B1C]/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]",
          headerTitle: "text-white font-bold tracking-tight",
          headerSubtitle: "text-slate-400",
          socialButtonsBlockButton: "border-white/10 hover:bg-white/5 text-white",
          socialButtonsBlockButtonText: "text-white",
          dividerLine: "bg-white/10",
          dividerText: "text-slate-500",
          formFieldLabel: "text-slate-300 text-sm",
          formFieldInput: "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500/50",
          formButtonPrimary: "bg-cyan-500 hover:bg-cyan-400 text-[#030614] font-semibold",
          footerActionLink: "text-cyan-400 hover:text-cyan-300",
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-cyan-400",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
