import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { Users } from "lucide-react";

export default function TeamPage() {
  return (
    <>
      <DashboardHeader title="Team" description="Manage team members and access" />

      <main className="flex-1 p-6">
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-8 flex flex-col items-center text-center max-w-md mx-auto mt-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
            <Users size={24} className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Team management coming soon</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Invite team members, assign roles and manage access. This feature will be available in the next update.
          </p>
          <a
            href="mailto:hello@mailmind.io"
            className="mt-6 text-sm text-primary hover:text-cyan-300 transition-colors"
          >
            Contact us to add team members →
          </a>
        </div>
      </main>
    </>
  );
}
