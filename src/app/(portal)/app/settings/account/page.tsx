import { UserProfile } from "@clerk/nextjs";
import { DashboardHeader } from "@/components/portal/DashboardHeader";

export default function AccountPage() {
  return (
    <>
      <DashboardHeader
        title="Account"
        description="Manage your profile and security settings"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
            <UserProfile 
              routing="hash"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "w-full shadow-none border-none bg-transparent",
                  navbar: "hidden lg:flex border-r border-white/5 bg-white/[0.01]",
                  pageScrollBox: "p-0",
                  headerTitle: "text-white text-xl font-bold",
                  headerSubtitle: "text-white/60 text-sm",
                  profileSectionTitleText: "text-white text-base font-semibold border-b border-white/5 pb-2 mb-4",
                  profileSectionSubtitleText: "text-white/50 text-xs mt-1",
                  profileSectionContent: "gap-6",
                  formFieldLabel: "text-white/70 text-xs font-medium mb-1.5",
                  formFieldInput: "bg-white/[0.03] border-white/10 text-white rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all",
                  formButtonPrimary: "bg-primary text-[#030614] hover:bg-cyan-300 transition-colors rounded-xl text-xs font-bold",
                  formButtonReset: "text-white/60 hover:text-white transition-colors text-xs font-medium",
                  navbarButton: "text-white/70 hover:text-primary transition-colors text-sm py-2.5 px-4 rounded-lg hover:bg-white/[0.03]",
                  navbarButtonActive: "text-primary bg-primary/5 font-semibold",
                  sidebarItem: "text-white/70 hover:text-white py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-all",
                  userPreviewMainIdentifier: "text-white font-semibold",
                  userPreviewSecondaryIdentifier: "text-white/50 text-xs",
                  accordionTriggerButton: "text-white/80 hover:text-white transition-colors",
                  badge: "bg-primary/10 text-primary border border-primary/20",
                }
              }}
            />
          </div>
        </div>
      </main>
    </>
  );
}
