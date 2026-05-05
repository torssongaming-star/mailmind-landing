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
          Clerk's UserProfile component — handles:
          - Name / profile picture
          - Email addresses
          - Password change
          - Connected accounts (Google/Microsoft OAuth)
          - Active sessions
          - Delete account
        */}
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-[#050B1C]/80 border border-white/10 shadow-none backdrop-blur-sm rounded-2xl",
              navbar: "border-r border-white/5",
              navbarButton: "text-muted-foreground hover:text-white",
              navbarButtonActive: "text-primary bg-primary/5",
              pageScrollBox: "p-6",
              headerTitle: "text-white font-bold",
              formFieldInput: "bg-white/5 border-white/10 text-white",
              formButtonPrimary: "bg-primary text-[#030614] hover:bg-cyan-300",
              badge: "bg-primary/10 text-primary border-primary/20",
            },
          }}
        />
      </main>
    </>
  );
}
