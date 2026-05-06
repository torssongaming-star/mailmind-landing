/**
 * /app/onboarding — explicit onboarding for users who are authenticated via
 * Clerk but not yet provisioned in the Mailmind DB.
 *
 * This is reached when the (app)/layout.tsx detects `user === null` in the
 * AccountSnapshot. The page provisions the user + organization on demand
 * when they click "Start using Mailmind".
 *
 * Why an explicit step instead of silent auto-provisioning:
 *   - The user gets clear feedback that an account is being created.
 *   - We can capture additional onboarding info later (org name, role, etc.)
 *     without changing the auth boundary.
 *   - Audit log entry is unambiguous: we know exactly when onboarding completed.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser) {
    redirect("/login");
  }

  // If the user is already provisioned, skip straight to the app.
  const account = await getCurrentAccount(userId);
  if (account.user) {
    redirect("/app");
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const firstName = clerkUser.firstName ?? "";
  const suggestedOrgName = firstName ? `${firstName}'s Workspace` : `${email.split("@")[0]}'s Workspace`;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#030614]">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
            M
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white mb-2">Welcome to Mailmind</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Let&apos;s set up your workspace. You can change these details anytime in settings.
            </p>
          </div>

          <OnboardingForm
            email={email}
            suggestedOrgName={suggestedOrgName}
          />

          <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
            By continuing you agree to the{" "}
            <a href="/terms" className="text-primary hover:underline">Terms</a>
            {" and "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
