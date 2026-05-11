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
import { SettingsTabs } from "./SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const [settings, caseTypes, templates, knowledge, blocklist, webhooks] = await Promise.all([
    getAiSettings(account.organization.id),
    listCaseTypes(account.organization.id),
    listTemplates(account.organization.id),
    listKnowledge(account.organization.id),
    listBlocklist(account.organization.id),
    listWebhooks(account.organization.id),
  ]);

  const initialSettings = settings ?? defaultAiSettings(account.organization.id);

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">App</p>
          <h1 className="text-2xl font-bold text-white">Inställningar</h1>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white transition-colors">
          ← Hem
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

      />
    </main>
  );
}
