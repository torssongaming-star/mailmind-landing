"use client";

/**
 * Settings layout — Vercel/Linear-inspired.
 *
 * Vertical sidebar nav on the left, content area on the right.
 * All panels stay mounted (hidden via CSS) so switching is instant.
 */

import { useState } from "react";
import {
  Building2, Bot, Tag, BookOpen, FileText, ShieldOff, Webhook,
} from "lucide-react";
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

// ── Nav items ──────────────────────────────────────────────────────────────────

const NAV = [
  {
    id:    "general",
    label: "Arbetsyta",
    icon:  Building2,
    desc:  "Namn, AI-ton och språk",
  },
  {
    id:    "casetypes",
    label: "Ärendetyper",
    icon:  Tag,
    desc:  "Kategorier och obligatoriska fält",
  },
  {
    id:    "knowledge",
    label: "Kunskapsbas",
    icon:  BookOpen,
    desc:  "FAQ injicerade i varje AI-anrop",
  },
  {
    id:    "templates",
    label: "Svarsmallar",
    icon:  FileText,
    desc:  "Sparade standardsvar",
  },
  {
    id:    "blocklist",
    label: "Blocklista",
    icon:  ShieldOff,
    desc:  "Ignorerade avsändare",
  },
  {
    id:    "webhooks",
    label: "Webhooks",
    icon:  Webhook,
    desc:  "Notifikationer till externa system",
  },
] as const;

type SectionId = (typeof NAV)[number]["id"];

// ── Component ──────────────────────────────────────────────────────────────────

export function SettingsTabs({
  orgName,
  initialSettings,
  caseTypes,
  knowledge,
  templates,
  blocklist,
  webhooks,
}: Props) {
  const [active, setActive] = useState<SectionId>("general");
  const current = NAV.find(n => n.id === active)!;

  return (
    <div className="flex gap-0 min-h-[600px] rounded-2xl border border-white/8 overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <nav className="w-52 shrink-0 border-r border-white/8 bg-[#020510] py-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
          Inställningar
        </p>
        {NAV.map(item => {
          const Icon     = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={[
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group relative",
                isActive
                  ? "text-white bg-white/[0.05]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]",
              ].join(" ")}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-white/30 group-hover:text-white/50"}`} />
              <span className="text-xs font-medium truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Section header — always visible, changes with active section */}
        <div className="sticky top-0 z-10 px-8 py-5 border-b border-white/8 bg-[#030614]/95 backdrop-blur-sm flex items-center gap-3">
          <current.icon className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-white leading-none">{current.label}</h2>
            <p className="text-[11px] text-white/35 mt-0.5">{current.desc}</p>
          </div>
        </div>

        {/* Panels — mounted but hidden when inactive */}
        <div className="px-8 py-7 space-y-8">

          <div className={active === "general" ? "space-y-8" : "hidden"}>
            <SettingsRow
              title="Namn på arbetsyta"
              desc="Visas i appen och i mejl skickade från Mailmind."
            >
              <OrganizationEditor initialName={orgName} />
            </SettingsRow>
            <Divider />
            <SettingsRow
              title="AI-beteende"
              desc="Ton, språk och hur många frågor AI:n max ställer innan den eskalerar."
            >
              <AiSettingsEditor initial={initialSettings} />
            </SettingsRow>
          </div>

          <div className={active === "casetypes" ? "" : "hidden"}>
            <SettingsRow
              title="Ärendetyper"
              desc="Kategorier AI:n klassificerar inkommande mejl i. Ange vilka fält som måste samlas in från kunden innan ärendet routas vidare."
            >
              <CaseTypesEditor initial={caseTypes} />
            </SettingsRow>
          </div>

          <div className={active === "knowledge" ? "space-y-4" : "hidden"}>
            <div>
              <h3 className="text-sm font-semibold text-white">Kunskapsbas</h3>
              <p className="text-xs text-white/35 leading-relaxed mt-0.5">
                FAQ och företagsfakta som injiceras i varje AI-anrop. Priser, öppettider, policyer — lägg till det AI:n bör kunna svara direkt på.
              </p>
            </div>
            <KnowledgeEditor initial={knowledge} />
          </div>

          <div className={active === "templates" ? "" : "hidden"}>
            <SettingsRow
              title="Svarsmallar"
              desc='Sparade canned responses som agenter kan klistra in snabbt. T.ex. "Offert mottagen" eller "Bokning bekräftad".'
            >
              <TemplatesEditor initial={templates} />
            </SettingsRow>
          </div>

          <div className={active === "blocklist" ? "" : "hidden"}>
            <SettingsRow
              title="Blocklista"
              desc="Mejl från dessa avsändare ignoreras helt av AI:n och räknas inte mot autosvar-gränsen. Stöder exakt adress (user@example.com) och domän (@example.com)."
            >
              <BlocklistEditor
                initial={blocklist.map(b => ({
                  id:        b.id,
                  pattern:   b.pattern,
                  reason:    b.reason,
                  createdAt: b.createdAt,
                }))}
              />
            </SettingsRow>
          </div>

          <div className={active === "webhooks" ? "" : "hidden"}>
            <SettingsRow
              title="Webhooks"
              desc="Skicka ett HTTP POST till en extern URL när ett ärende klassificeras. Användbart för att trigga egna automationer i t.ex. Slack, CRM eller ticketsystem."
            >
              <WebhooksEditor
                initial={webhooks}
                caseTypes={caseTypes.map(c => ({ slug: c.slug, label: c.label }))}
              />
            </SettingsRow>
          </div>

        </div>
      </div>

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function SettingsRow({
  title,
  desc,
  children,
}: {
  title:    string;
  desc:     string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-white/35 leading-relaxed">{desc}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-white/5" />;
}
