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
import { listCaseTypes } from "@/lib/app/threads";
import { OnboardingForm } from "./OnboardingForm";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Välkommen" };

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser) {
    redirect("/login");
  }

  const account = await getCurrentAccount(userId);

  // Already fully onboarded (user + at least one case type) → send to app.
  if (account.user) {
    const caseTypes = await listCaseTypes(account.organization.id);
    if (caseTypes.length > 0) redirect("/app");
    // else: user exists but onboarding was interrupted — fall through to show form
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const firstName = clerkUser.firstName ?? "";
  const suggestedOrgName = firstName ? `${firstName}'s Workspace` : `${email.split("@")[0]}'s Workspace`;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--surface-base))] relative overflow-hidden">
      {/* Atmospheric glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 600px 400px at 20% 20%, hsl(189 94% 43% / 0.10), transparent 60%), " +
            "radial-gradient(ellipse 500px 400px at 80% 80%, hsl(262 83% 58% / 0.08), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-2xl" aria-hidden />
            <div
              className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold border border-primary/30 shadow-[0_4px_24px_-2px_hsl(189_94%_43%/0.4)]"
              style={{ background: "linear-gradient(135deg, #06b6d4, #8B5CF6)" }}
            >
              M
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-md p-8 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Välkommen till Mailmind</h1>
            <p className="text-sm text-white/55 leading-relaxed">
              Sätt upp arbetsytan på två minuter. Du kan ändra allt senare i inställningarna.
            </p>
          </div>

          <OnboardingForm
            email={email}
            suggestedOrgName={suggestedOrgName}
          />

          <p className="text-[11px] text-white/35 mt-6 leading-relaxed">
            Genom att fortsätta godkänner du{" "}
            <a href="/terms" className="text-primary hover:underline">Villkoren</a>
            {" och "}
            <a href="/privacy" className="text-primary hover:underline">Integritetspolicyn</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
