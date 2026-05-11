/**
 * /app/settings — tabbed layout to avoid the single long scroll.
 *
 * Tab navigation is URL-driven (?tab=X) so every tab is bookmarkable,
 * works without JS, and doesn't require a client component wrapper.
 *
 * Tabs:
 *   general    — Workspace + AI tone/language/signature
 *   casetypes  — Case types
 *   knowledge  — Knowledge base (FAQs injected into AI)
 *   templates  — Reply templates
 *   tools      — Blocklist + Webhooks
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

const TABS = [
  { id: "general",   label: "Allmänt" },
  { id: "casetypes", label: "Ärendetyper" },
  { id: "knowledge", label: "Kunskapsbas" },
  { id: "templates", label: "Mallar" },
  { id: "tools",     label: "Verktyg" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const params  = await searchParams;
  const rawTab  = params.tab ?? "general";
  const activeTab: TabId = TABS.some(t => t.id === rawTab)
    ? (rawTab as TabId)
    : "general";

  // Only fetch what the active tab needs
  const [settings, caseTypes, templates, knowledge, blocklist, webhooks] = await Promise.all([
    activeTab === "general"   || activeTab === "casetypes" || activeTab === "tools"
      ? getAiSettings(account.organization.id) : Promise.resolve(null),
    activeTab === "casetypes" || activeTab === "tools"
      ? listCaseTypes(account.organization.id) : Promise.resolve([]),
    activeTab === "templates"
      ? listTemplates(account.organization.id) : Promise.resolve([]),
    activeTab === "knowledge"
      ? listKnowledge(account.organization.id) : Promise.resolve([]),
    activeTab === "tools"
      ? listBlocklist(account.organization.id) : Promise.resolve([]),
    activeTab === "tools"
      ? listWebhooks(account.organization.id) : Promise.resolve([]),
  ]);

  const initialSettings = settings ?? defaultAiSettings(account.organization.id);

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Inställningar</p>
          <h1 className="text-2xl font-bold text-white">
            {TABS.find(t => t.id === activeTab)?.label}
          </h1>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white transition-colors">
          ← Hem
        </Link>
      </header>

      {/* Tab bar */}
      <nav className="flex gap-1 border-b border-white/8 pb-0 -mb-2">
        {TABS.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={`/app/settings?tab=${tab.id}`}
              className={[
                "px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px",
                isActive
                  ? "text-white border-primary bg-white/[0.03]"
                  : "text-muted-foreground border-transparent hover:text-white hover:bg-white/[0.02]",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Tab content */}
      <div className="pt-2 space-y-8">

        {/* ── Allmänt ─────────────────────────────────────── */}
        {activeTab === "general" && (
          <>
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Arbetsyta</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Namnet syns i appen och i mejl skickade från Mailmind.
                </p>
              </div>
              <OrganizationEditor initialName={account.organization.name} />
            </section>

            <div className="border-t border-white/5" />

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-white">AI — ton &amp; språk</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Hur AI:n låter när den svarar kunder. Gäller alla utkast.
                </p>
              </div>
              <AiSettingsEditor
                initial={{
                  tone:            initialSettings.tone,
                  language:        initialSettings.language,
                  maxInteractions: initialSettings.maxInteractions,
                  signature:       initialSettings.signature,
                }}
              />
            </section>
          </>
        )}

        {/* ── Ärendetyper ─────────────────────────────────── */}
        {activeTab === "casetypes" && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Ärendetyper</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Kategorier AI:n använder för att klassificera inkommande mejl.
                Definiera vilka fält som måste samlas in innan ärendet routas.
              </p>
            </div>
            <CaseTypesEditor initial={caseTypes} />
          </section>
        )}

        {/* ── Kunskapsbas ─────────────────────────────────── */}
        {activeTab === "knowledge" && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Kunskapsbas</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Vanliga frågor och svar som AI:n känner till. Priser, öppettider,
                policyer m.m. Aktiva svar injiceras i varje AI-anrop.
              </p>
            </div>
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
        )}

        {/* ── Mallar ──────────────────────────────────────── */}
        {activeTab === "templates" && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Svarsmallar</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sparade standardsvar som teamet snabbt kan klistra in.
                Bra för vanliga svar som &quot;Offert mottagen&quot; och &quot;Bokning bekräftad&quot;.
              </p>
            </div>
            <TemplatesEditor initial={templates} />
          </section>
        )}

        {/* ── Verktyg ─────────────────────────────────────── */}
        {activeTab === "tools" && (
          <>
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Blocklista</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Mejl från dessa avsändare ignoreras av AI:n och räknas inte mot autosvar.
                </p>
              </div>
              <BlocklistEditor
                initial={blocklist.map(b => ({
                  id:        b.id,
                  pattern:   b.pattern,
                  reason:    b.reason ?? null,
                  createdAt: b.createdAt,
                }))}
              />
            </section>

            <div className="border-t border-white/5" />

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Webhooks</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Skicka automatiska notifikationer till externa system när ett ärende klassificeras.
                </p>
              </div>
              <WebhooksEditor
                initial={webhooks}
                caseTypes={caseTypes.map(c => ({ slug: c.slug, label: c.label }))}
              />
            </section>
          </>
        )}

      </div>
    </main>
  );
}
