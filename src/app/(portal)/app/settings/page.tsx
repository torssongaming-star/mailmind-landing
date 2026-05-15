/**
 * /app/settings — loads all data server-side, hands off to SettingsTabs
 * (client component) for instant zero-delay tab switching.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getAiSettings, listCaseTypes, defaultAiSettings } from "@/lib/app/threads";
import { listTemplates } from "@/lib/app/notes";
import { listKnowledge } from "@/lib/app/knowledge";
import { listBlocklist } from "@/lib/app/blocklist";
import { listWebhooks } from "@/lib/app/webhooks";
import { listMembers, listPendingInvites } from "@/lib/app/team";
import { getTranslations } from "@/lib/i18n";
import { getUserLocale } from "@/lib/i18n/get-locale";
import { SettingsTabs } from "./SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const locale = await getUserLocale();
  const { t } = getTranslations(locale);

  const [settings, caseTypes, templates, knowledge, blocklist, webhooks, teamMembers, teamInvites] = await Promise.all([
    getAiSettings(account.organization.id),
    listCaseTypes(account.organization.id),
    listTemplates(account.organization.id),
    listKnowledge(account.organization.id),
    listBlocklist(account.organization.id),
    listWebhooks(account.organization.id),
    listMembers(account.organization.id),
    listPendingInvites(account.organization.id),
  ]);

  const initialSettings = settings ?? defaultAiSettings(account.organization.id);

  return (
    <main className="p-6 md:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">App</p>
          <h1 className="text-2xl font-bold text-white">{t("settings.title")}</h1>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white transition-colors">
          ← {t("nav.overview")}
        </Link>
      </header>

      <SettingsTabs
        orgName={account.organization.name}
        initialSettings={{
          tone:            initialSettings.tone,
          language:        initialSettings.language,
          maxInteractions: initialSettings.maxInteractions,
          signature:       initialSettings.signature,
        }}
        caseTypes={caseTypes}
        knowledge={knowledge.map(k => ({
          id:       k.id,
          question: k.question,
          answer:   k.answer,
          category: k.category,
          isActive: k.isActive,
        }))}
        templates={templates}
        blocklist={blocklist.map(b => ({
          id:        b.id,
          pattern:   b.pattern,
          reason:    b.reason ?? null,
          createdAt: b.createdAt,
        }))}
        webhooks={webhooks}
        teamMembers={teamMembers.map(m => ({
          id:        m.id,
          email:     m.email,
          role:      m.role,
          createdAt: m.createdAt,
        }))}
        teamInvites={teamInvites.map(i => ({
          id:        i.id,
          email:     i.email,
          role:      i.role,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        }))}
        currentUserId={account.user.id}
        currentUserRole={account.user.role}
        seatLimit={account.entitlements?.maxUsers ?? 5}
      />
    </main>
  );
}
