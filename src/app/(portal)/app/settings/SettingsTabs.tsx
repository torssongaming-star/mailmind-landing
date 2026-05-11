"use client";

import { useState } from "react";
import { AiSettingsEditor } from "./AiSettingsEditor";
import { CaseTypesEditor } from "./CaseTypesEditor";
import { OrganizationEditor } from "./OrganizationEditor";
import { TemplatesEditor } from "./TemplatesEditor";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { BlocklistEditor } from "./BlocklistEditor";
import { WebhooksEditor } from "./WebhooksEditor";
import type {
  AiSettings, CaseType, KnowledgeEntry,
  ReplyTemplate, WebhookEndpoint,
} from "@/lib/db/schema";

type BlockEntry = { id: string; pattern: string; reason: string | null; createdAt: Date };

type Props = {
  orgName:         string;
  initialSettings: Pick<AiSettings, "tone" | "language" | "maxInteractions" | "signature">;
  caseTypes:       CaseType[];
  knowledge:       Pick<KnowledgeEntry, "id" | "question" | "answer" | "category" | "isActive">[];
  templates:       ReplyTemplate[];
  blocklist:       BlockEntry[];
  webhooks:        WebhookEndpoint[];
};

const TABS = [
  { id: "general",   label: "Allmänt" },
  { id: "casetypes", label: "Ärendetyper" },
  { id: "knowledge", label: "Kunskapsbas" },
  { id: "templates", label: "Mallar" },
  { id: "tools",     label: "Verktyg" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsTabs({
  orgName,
  initialSettings,
  caseTypes,
  knowledge,
  templates,
  blocklist,
  webhooks,
}: Props) {
  const [active, setActive] = useState<TabId>("general");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <nav className="flex gap-1 border-b border-white/8">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={[
              "px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px",
              active === tab.id
                ? "text-white border-primary bg-white/[0.03]"
                : "text-muted-foreground border-transparent hover:text-white hover:bg-white/[0.02]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content — all panels stay mounted, hidden ones are just invisible */}
      <div className="pt-2">

        <div className={active === "general" ? "space-y-8" : "hidden"}>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Arbetsyta</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Namnet syns i appen och i mejl skickade från Mailmind.
              </p>
            </div>
            <OrganizationEditor initialName={orgName} />
          </section>
          <div className="border-t border-white/5" />
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">AI — ton &amp; språk</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Hur AI:n låter när den svarar kunder. Gäller alla utkast.
              </p>
            </div>
            <AiSettingsEditor initial={initialSettings} />
          </section>
        </div>

        <div className={active === "casetypes" ? "space-y-3" : "hidden"}>
          <div>
            <h2 className="text-sm font-semibold text-white">Ärendetyper</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Kategorier AI:n använder för att klassificera inkommande mejl.
              Definiera vilka fält som måste samlas in innan ärendet routas.
            </p>
          </div>
          <CaseTypesEditor initial={caseTypes} />
        </div>

        <div className={active === "knowledge" ? "space-y-3" : "hidden"}>
          <div>
            <h2 className="text-sm font-semibold text-white">Kunskapsbas</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Vanliga frågor och svar som AI:n känner till. Priser, öppettider,
              policyer m.m. Aktiva svar injiceras i varje AI-anrop.
            </p>
          </div>
          <KnowledgeEditor initial={knowledge} />
        </div>

        <div className={active === "templates" ? "space-y-3" : "hidden"}>
          <div>
            <h2 className="text-sm font-semibold text-white">Svarsmallar</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Sparade standardsvar som teamet snabbt kan klistra in.
              Bra för vanliga svar som &quot;Offert mottagen&quot; och &quot;Bokning bekräftad&quot;.
            </p>
          </div>
          <TemplatesEditor initial={templates} />
        </div>

        <div className={active === "tools" ? "space-y-8" : "hidden"}>
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
                reason:    b.reason,
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
        </div>

      </div>
    </div>
  );
}
