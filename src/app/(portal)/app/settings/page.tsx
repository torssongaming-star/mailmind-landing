/**
 * /app/settings — AI behaviour + case types editor.
 *
 * Server component loads current state, then hands off to client editors.
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
import { AiSettingsEditor } from "./AiSettingsEditor";
import { CaseTypesEditor } from "./CaseTypesEditor";
import { OrganizationEditor } from "./OrganizationEditor";
import { TemplatesEditor } from "./TemplatesEditor";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { BlocklistEditor } from "./BlocklistEditor";
import { WebhooksEditor } from "./WebhooksEditor";

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

  // Settings dates are not serialisable — pass strings to the client component
  const initialSettings = settings ?? defaultAiSettings(account.organization.id);

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">

      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">App settings</p>
          <h1 className="text-2xl font-bold text-white">Configure AI behaviour</h1>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white transition-colors">
          ← App home
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Workspace</h2>
        <p className="text-xs text-muted-foreground">
          Your workspace name appears in the app and on emails sent from Mailmind.
        </p>
        <OrganizationEditor initialName={account.organization.name} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">AI tone &amp; language</h2>
        <p className="text-xs text-muted-foreground">
          How the AI sounds when replying to your customers. Applies to every draft.
        </p>
        <AiSettingsEditor
          initial={{
            tone:            initialSettings.tone,
            language:        initialSettings.language,
            maxInteractions: initialSettings.maxInteractions,
            signature:       initialSettings.signature,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Case types</h2>
        <p className="text-xs text-muted-foreground">
          Categories the AI uses to classify incoming emails. For each type, define
          which fields the AI must collect from the customer before routing the case.
        </p>
        <CaseTypesEditor initial={caseTypes} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Reply templates</h2>
        <p className="text-xs text-muted-foreground">
          Saved canned responses your team can quickly insert. Useful for common
          replies like &quot;Quote received&quot;, &quot;Booking confirmed&quot;, etc.
        </p>
        <TemplatesEditor initial={templates} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Blocklista</h2>
        <p className="text-xs text-muted-foreground">
          Mejl från dessa avsändare ignoreras automatiskt.
        </p>
        <BlocklistEditor
          initial={blocklist.map(b => ({
            id:        b.id,
            pattern:   b.pattern,
            reason:    b.reason ?? null,
            createdAt: b.createdAt,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Webhooks</h2>
        <p className="text-xs text-muted-foreground">
          Skicka automatiska notifikationer till externa system när ett ärende klassificeras.
        </p>
        <WebhooksEditor
          initial={webhooks}
          caseTypes={caseTypes.map(c => ({ slug: c.slug, label: c.label }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Kunskapsbas</h2>
        <p className="text-xs text-muted-foreground">
          Vanliga frågor och svar som AI:n känner till. Importera från din hemsida
          eller lägg till manuellt — priser, öppettider, policyer m.m.
          Aktiva svar injiceras i varje AI-anrop.
        </p>
        <KnowledgeEditor
          initial={knowledge.map(k => ({
            id:       k.id,
            question: k.question,
            answer:   k.answer,
            category: k.category,
            isActive: k.isActive,
          }))}
        />
      </section>

    </main>
  );
}
