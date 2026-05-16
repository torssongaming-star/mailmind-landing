import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { LanguageSelector } from "./LanguageSelector";
import { PushNotifications } from "@/components/app/PushNotifications";
import { DataPrivacy } from "./DataPrivacy";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getTranslations } from "@/lib/i18n";
import { getUserLocale } from "@/lib/i18n/get-locale";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const locale = await getUserLocale();
  const { t } = getTranslations(locale);

  const { userId } = await auth();
  if (!userId) redirect("/login");
  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  const isOwner = account.user.role === "owner";

  return (
    <>
      <DashboardHeader
        title={t("settings.account.title")}
        description={t("settings.account.description")}
      />

      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto w-full max-w-5xl space-y-8">
          <LanguageSelector />

          <PushNotifications vapidPublicKey={vapidPublicKey} variant="card" />

          <DataPrivacy
            isOwner={isOwner}
            orgName={account.organization.name}
            deletionRequestedAt={account.organization.deletionRequestedAt}
          />

          <div className="mailmind-account-profile">
            <UserProfile

            routing="hash"
            appearance={{
              variables: {
                colorPrimary: "#06b6d4",
                colorBackground: "#050B1C",
                colorText: "#ffffff",
                colorTextSecondary: "#cbd5e1",
                colorInputBackground: "#0A1025",
                colorInputText: "#ffffff",
                borderRadius: "1rem",
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-none",
                card: "w-full shadow-none bg-transparent border-none",
                headerTitle: "text-white",
                headerSubtitle: "text-slate-300",
                navbar: "bg-transparent border-r border-white/5",
                navbarButton: "text-slate-300 hover:text-white hover:bg-white/5",
                navbarButtonActive: "text-cyan-400 bg-cyan-400/10 font-bold",
                profileSectionTitleText: "text-white font-bold",
                profileSectionSubtitleText: "text-slate-300",
                userPreviewMainIdentifier: "text-white font-semibold",
                userPreviewSecondaryIdentifier: "text-slate-300",
                badge: "bg-cyan-400/15 text-cyan-300 border border-cyan-400/30",
                scrollBox: "bg-transparent",
                pageScrollBox: "bg-transparent",
                profileSectionContent: "bg-transparent",
                formFieldLabel: "text-slate-200",
                formFieldInput: "bg-[#0A1025] border-white/10 text-white focus:border-cyan-400/50",
                formButtonPrimary: "bg-cyan-400 text-black hover:bg-cyan-300 font-bold",
                formButtonReset: "text-slate-400 hover:text-white",
                socialButtonsBlockButton: "bg-white/5 border-white/10 text-white hover:bg-white/10",
                socialButtonsBlockButtonText: "text-white font-medium",
                socialButtonsBlockButtonArrow: "text-white/30",
                developmentMode: "hidden",
              },
            }}
            />
          </div>
        </div>
      </main>

    </>
  );
}
