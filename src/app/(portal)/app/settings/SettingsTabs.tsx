"use client";

/**
 * Settings layout — Vercel/Linear-inspired.
 *
 * Vertical sidebar nav on the left, content area on the right.
 * All panels stay mounted (hidden via CSS) so switching is instant.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2, Bot, Tag, BookOpen, FileText, ShieldOff, Webhook, Users,
} from "lucide-react";
import { AiSettingsEditor } from "./AiSettingsEditor";
import { CaseTypesEditor } from "./CaseTypesEditor";
import { OrganizationEditor } from "./OrganizationEditor";
import { TemplatesEditor } from "./TemplatesEditor";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { BlocklistEditor } from "./BlocklistEditor";
import { WebhooksEditor } from "./WebhooksEditor";
import { TeamEditor } from "./TeamEditor";
import type {
  AiSettings, CaseType, KnowledgeEntry,
  ReplyTemplate, WebhookEndpoint,
} from "@/lib/db/schema";

type BlockEntry  = { id: string; pattern: string; reason: string | null; createdAt: Date };
type TeamMember  = { id: string; email: string; role: string; createdAt: Date | string };
type TeamInvite  = { id: string; email: string; role: string; expiresAt: Date | string; createdAt: Date | string };

type Props = {
  orgName:          string;
  initialSettings:  Pick<AiSettings, "tone" | "language" | "maxInteractions" | "signature">;
  caseTypes:        CaseType[];
  knowledge:        Pick<KnowledgeEntry, "id" | "question" | "answer" | "category" | "isActive">[];
  templates:        ReplyTemplate[];
  blocklist:        BlockEntry[];
  webhooks:         WebhookEndpoint[];
  teamMembers:      TeamMember[];
  teamInvites:      TeamInvite[];
  currentUserId:    string;
  currentUserRole:  string;
  seatLimit:        number;
};

import { useI18n } from "@/lib/i18n/context";

type SectionId = "general" | "casetypes" | "knowledge" | "templates" | "blocklist" | "webhooks" | "team";

export function SettingsTabs({
  orgName,
  initialSettings,
  caseTypes,
  knowledge,
  templates,
  blocklist,
  webhooks,
  teamMembers,
  teamInvites,
  currentUserId,
  currentUserRole,
  seatLimit,
}: Props) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SectionId | null) ?? "general";
  const [active, setActive] = useState<SectionId>(
    ["general","casetypes","knowledge","templates","blocklist","webhooks","team"].includes(initialTab)
      ? initialTab
      : "general"
  );

  const NAV = [
    {
      id:    "general",
      label: t("settings.tabs.general"),
      icon:  Building2,
      desc:  t("settings.tabs.generalDesc"),
    },
    {
      id:    "casetypes",
      label: t("settings.tabs.caseTypes"),
      icon:  Tag,
      desc:  t("settings.tabs.caseTypesDesc"),
    },
    {
      id:    "knowledge",
      label: t("settings.tabs.knowledge"),
      icon:  BookOpen,
      desc:  t("settings.tabs.knowledgeDesc"),
    },
    {
      id:    "templates",
      label: t("settings.tabs.templates"),
      icon:  FileText,
      desc:  t("settings.tabs.templatesDesc"),
    },
    {
      id:    "blocklist",
      label: t("settings.tabs.blocklist"),
      icon:  ShieldOff,
      desc:  t("settings.tabs.blocklistDesc"),
    },
    {
      id:    "webhooks",
      label: t("settings.tabs.webhooks"),
      icon:  Webhook,
      desc:  t("settings.tabs.webhooksDesc"),
    },
    {
      id:    "team",
      label: "Team",
      icon:  Users,
      desc:  "Hantera medlemmar och inbjudningar",
    },
  ] as const;

  const current = NAV.find(n => n.id === active)!;

  return (
    <div className="flex gap-0 min-h-[600px] rounded-2xl border border-white/8 overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <nav className="w-52 shrink-0 border-r border-white/8 bg-[#020510] py-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
          {t("settings.title")}
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
              title={t("settings.workspace.name")}
              desc={t("settings.workspace.nameDesc")}
            >
              <OrganizationEditor initialName={orgName} />
            </SettingsRow>
            <Divider />
            <SettingsRow
              title={t("settings.workspace.aiBehavior")}
              desc={t("settings.workspace.aiBehaviorDesc")}
            >
              <AiSettingsEditor initial={initialSettings} />
            </SettingsRow>
          </div>

          <div className={active === "casetypes" ? "" : "hidden"}>
            <SettingsRow
              title={t("settings.workspace.caseTypes")}
              desc={t("settings.workspace.caseTypesDesc")}
            >
              <CaseTypesEditor initial={caseTypes} />
            </SettingsRow>
          </div>

          <div className={active === "knowledge" ? "" : "hidden"}>
            <SettingsRow
              title={t("settings.workspace.knowledge")}
              desc={t("settings.workspace.knowledgeDesc")}
            >
              <KnowledgeEditor initial={knowledge} />
            </SettingsRow>
          </div>

          <div className={active === "templates" ? "" : "hidden"}>
            <SettingsRow
              title={t("settings.workspace.templates")}
              desc={t("settings.workspace.templatesDesc")}
            >
              <TemplatesEditor initial={templates} />
            </SettingsRow>
          </div>

          <div className={active === "blocklist" ? "" : "hidden"}>
            <SettingsRow
              title={t("settings.workspace.blocklist")}
              desc={t("settings.workspace.blocklistDesc")}
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
              title={t("settings.workspace.webhooks")}
              desc={t("settings.workspace.webhooksDesc")}
            >
              <WebhooksEditor
                initial={webhooks}
                caseTypes={caseTypes.map(c => ({ slug: c.slug, label: c.label }))}
              />
            </SettingsRow>
          </div>

          <div className={active === "team" ? "" : "hidden"}>
            <SettingsRow
              title="Teammedlemmar"
              desc="Bjud in kollegor och hantera roller för din arbetsyta."
            >
              <TeamEditor
                initialMembers={teamMembers}
                initialInvites={teamInvites}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                seatLimit={seatLimit}
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
