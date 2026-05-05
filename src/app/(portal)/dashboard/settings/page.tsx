import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { UserProfile } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <>
      <DashboardHeader
        title="Settings"
        description="Manage your account, email and password"
      />
      <main className="flex-1 p-6">
        {/*
          Clerk's UserProfile component — heavily styled for high contrast
          in the dark theme.
        */}
        <UserProfile
          appearance={{
            variables: {
              colorPrimary: "#06b6d4",
              colorText: "#f1f5f9",
              colorTextSecondary: "#cbd5e1", // slate-300
              colorBackground: "#050B1C",
              colorInputBackground: "#111d35",
              colorInputText: "#ffffff",
            },
            elements: {
              rootBox: "w-full",
              card: "bg-[#050B1C]/80 border border-white/10 shadow-none backdrop-blur-sm rounded-2xl overflow-hidden",
              navbar: "border-r border-white/5 bg-black/20",
              navbarButton: "text-slate-400 hover:text-white transition-colors",
              navbarButtonActive: "text-primary bg-primary/10 font-bold",
              
              headerTitle: "text-white font-bold tracking-tight text-xl",
              headerSubtitle: "text-slate-400 text-sm",
              
              profileSectionTitleText: "text-white font-semibold",
              profileSectionSubtitleText: "text-slate-400",
              profileSectionPrimaryButton: "text-primary hover:text-cyan-300 font-medium",
              
              formFieldLabel: "text-slate-200 font-medium mb-1.5",
              formFieldInput: "bg-[#111d35] border-white/15 text-white focus:border-primary/50",
              formFieldHintText: "text-slate-500",
              
              formButtonPrimary: "bg-primary text-[#030614] hover:bg-cyan-300 font-bold px-6",
              formButtonReset: "text-slate-300 hover:text-white",
              
              activeDeviceIcon: "text-primary",
              activeDeviceName: "text-white",
              activeDeviceType: "text-slate-400",
              
              badge: "bg-primary/10 text-primary border-primary/20 font-bold",
              
              accordionTriggerButton: "text-white hover:bg-white/5",
              accordionContent: "text-slate-300",
              
              breadcrumbsItem: "text-slate-400",
              breadcrumbsItemActive: "text-white font-bold",
              breadcrumbsSeparator: "text-slate-600",
              
              fileInputButtonPrimary: "bg-white/10 text-white hover:bg-white/20",
              
              // Tables / Lists inside UserProfile
              scrollBox: "custom-scrollbar",
              pageScrollBox: "p-6 md:p-8",
            },
          }}
        />
      </main>
    </>
  );
}
