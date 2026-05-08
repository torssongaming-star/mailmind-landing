import { UserProfile } from "@clerk/nextjs";
import { DashboardHeader } from "@/components/portal/DashboardHeader";

export default function AccountPage() {
  return (
    <>
      <DashboardHeader
        title="Account"
        description="Manage your profile and security settings"
      />
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* 
            Clerk UserProfile — integrated layout.
            We force transparent backgrounds and remove borders on the internal card 
            to make it feel like part of the page grid, not a floating modal.
          */}
          <UserProfile 
            routing="hash"
            localization={{
              errors: {
                user_exists_with_different_provider: "Den här e-postadressen används redan av ett annat konto.",
                email_address_claimed: "Den här e-postadressen används redan av ett annat konto.",
              }
            }}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-none border-none bg-transparent flex flex-col lg:flex-row gap-8",
                
                // Sidebar (Navbar)
                navbar: "w-full lg:w-[240px] shrink-0 border-none bg-transparent p-0 flex flex-col gap-1",
                navbarMobileMenuRow: "bg-[#050B1C] border border-white/10 rounded-xl mb-4",
                navbarButton: "text-white/60 hover:text-white hover:bg-white/5 transition-all py-2 px-3 rounded-xl text-sm font-medium justify-start",
                navbarButtonActive: "text-primary bg-primary/10 hover:bg-primary/15 font-semibold",
                
                // Headers & Typography
                headerTitle: "text-white text-2xl font-bold tracking-tight mb-1",
                headerSubtitle: "text-white/50 text-sm mb-6",
                profileSectionTitleText: "text-white text-lg font-semibold tracking-tight border-b border-white/5 pb-3 mb-6",
                profileSectionSubtitleText: "text-white/50 text-sm mt-1 mb-4 leading-relaxed",
                
                // Content Area
                pageScrollBox: "flex-1 p-0 bg-transparent",
                profileSection: "mb-10 last:mb-0",
                profileSectionContent: "gap-6",
                
                // Form Elements
                formFieldLabel: "text-white/80 text-sm font-medium mb-2",
                formFieldInput: "bg-[#0A1025] border-white/10 text-white rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all py-2.5 px-4",
                formButtonPrimary: "bg-primary text-[#030614] hover:bg-cyan-300 transition-colors rounded-xl text-sm font-bold py-2.5 px-6 shadow-[0_0_15px_rgba(6,182,212,0.2)]",
                formButtonReset: "text-white/60 hover:text-white transition-colors text-sm font-medium",
                
                // Connected Accounts / OAuth
                socialButtonsBlockButton: "bg-[#0A1025] border-white/10 text-white hover:bg-white/5 transition-colors rounded-xl py-3 px-4",
                socialButtonsBlockButtonText: "text-white font-medium ml-3",
                socialButtonsBlockButtonArrow: "text-white/30",
                
                // Identity / Email rows
                userPreviewMainIdentifier: "text-white font-semibold text-sm",
                userPreviewSecondaryIdentifier: "text-white/60 text-xs mt-0.5",
                profileSectionItem: "py-4 border-b border-white/5 last:border-0",
                
                // Badges
                badge: "bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                
                // Error Messages
                formResendCodeLink: "text-primary hover:text-cyan-300",
                alert: "bg-red-500/10 border-red-500/30 text-red-200 rounded-xl p-4 text-sm leading-relaxed",
                alertText: "text-red-200",
                
                // Misc
                accordionTriggerButton: "text-white/80 hover:text-white transition-colors",
                breadcrumbsItem: "text-white/50 hover:text-white transition-colors",
                breadcrumbsItemActive: "text-white font-medium",
                developmentMode: "hidden", // Hide the distracting dev mode banner
              }
            }}
          />
        </div>
      </main>
    </>
  );
}
