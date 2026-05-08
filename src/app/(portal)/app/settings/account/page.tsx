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
        <div className="mx-auto w-full max-w-5xl mailmind-account-profile">
          <UserProfile 
            routing="hash"
            appearance={{
              // We still use appearance for basics, but heavy lifting moves to CSS
              elements: {
                rootBox: "w-full",
                card: "w-full",
                navbar: "hidden lg:flex",
                pageScrollBox: "p-0",
              }
            }}
          />
        </div>
      </main>
    </>
  );
}
