import { UserProfile } from "@clerk/nextjs";
import { DashboardHeader } from "@/components/portal/DashboardHeader";

export default function AccountPage() {
  return (
    <>
      <DashboardHeader
        title="Account"
        description="Manage your profile and security settings"
      />
      <main className="flex-1 p-6 flex justify-center">
        <div className="w-full max-w-4xl">
          <UserProfile 
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-none border-none bg-transparent",
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
