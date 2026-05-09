"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

/**
 * Client-side provider wrapper.
 * Wraps the app in ClerkProvider with custom appearance variables
 * matching the Mailmind dark glass design system.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={{
        errors: {
          user_exists_with_different_provider: "Den här e-postadressen används redan av ett annat konto.",
          email_address_claimed: "Den här e-postadressen används redan av ett annat konto.",
          user_exists_with_different_password: "Den här e-postadressen används redan av ett annat konto.",
          identifier_already_exists: "Den här e-postadressen används redan av ett annat konto.",
        }
      } as any}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#06b6d4",         // cyan
          colorBackground: "#050B1C",      // Deep navy matching our --background
          colorInputBackground: "#0d1f3c", // lighter navy for inputs
          colorText: "#ffffff",            // High contrast text (RESTORED)
          colorTextSecondary: "#cbd5e1",   // Light slate text (RESTORED)
          colorNeutral: "#94a3b8",         // Slate-400
          borderRadius: "1rem",
          fontFamily: "Inter, sans-serif",
        },
        options: {
          unsafe_disableDevelopmentModeWarnings: true, // Turn off "Development mode" warning
        },
        elements: {
          // Card: Glass effect matching our design system
          card: "bg-[#050B1C]/95 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.4),0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl",
          
          // Header
          headerTitle: "text-2xl font-bold tracking-tight text-white",
          headerSubtitle: "text-base font-normal text-slate-400",

          // Logo Fix: Brighten the logo on dark background
          logoImage: "brightness-0 invert opacity-90 hover:opacity-100 transition-opacity",

          // Social auth buttons
          socialButtonsBlockButton: 
            "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200",
          socialButtonsBlockButtonText: "font-medium text-white",
          socialButtonsBlockButtonArrow: "opacity-50 text-white",
          
          // divider
          dividerLine: "bg-white/10",
          dividerText: "uppercase text-[10px] font-bold tracking-widest text-slate-500",

          // Form fields
          formFieldLabel: "text-xs font-semibold uppercase tracking-wider mb-1.5 text-slate-300",
          formFieldInput: 
            "bg-[#0d1f3c] border border-white/10 text-white " +
            "focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all",
          
          // Primary button
          formButtonPrimary: 
            "bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-[#030614] font-bold py-3 " +
            "shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all",

          // Footer links
          footerActionText: "text-slate-400",
          footerActionLink: "text-cyan-400 hover:text-cyan-300 font-semibold transition-colors",
          
          // Misc contrast fixes
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-cyan-400 hover:text-cyan-300",
          formFieldErrorText: "text-red-400 font-medium text-xs mt-1.5",
          formFieldSuccessText: "text-green-400",
          formFieldAction: "text-cyan-400 hover:text-cyan-300 text-xs font-medium",
          
          // Account / User Profile tab fixes
          userProfile: "text-white",
          userButtonPopoverCard: "bg-[#050B1C] border border-white/10 shadow-2xl",
          userButtonPopoverActionButtonText: "text-white",
          userButtonPopoverActionButtonIcon: "text-white/60",
          userButtonPopoverFooter: "border-t border-white/10",
          
          // Breadcrumbs and other small text
          breadcrumbItem: "text-slate-400",
          breadcrumbSeparator: "text-slate-600",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
