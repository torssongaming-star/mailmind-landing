"use client";

/**
 * AiSafetyPanel — visar Mailmind:s låsta AI-trygghetsvillkor för SMB.
 *
 * De fyra LOCKED produktbesluten i CLAUDE.md (confidence ≥ 90 %,
 * källgrundat, risknivå låg, inga blockeringsskäl) plus dry-run-flowen
 * lever idag i kod (autoSend.ts canAutoSend) men hade ingen surface i
 * SMB-UI:t förutom badges i thread-vyn. Det här är översiktssidan.
 *
 * Read-only för SMB. Toggles för dry-run/auto-send hanteras via admin-
 * panelen — vi visar bara status så användaren förstår vad som händer
 * bakom kulisserna.
 */

import { ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Info } from "lucide-react";

const AUTO_SEND_CONFIDENCE_THRESHOLD_PERCENT = 90;
const MIN_INTERACTIONS_FOR_AUTOSEND = 3;

export function AiSafetyPanel({
  dryRunEnabled,
  autoSendEnabled,
}: {
  dryRunEnabled:   boolean;
  autoSendEnabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* ── Dry-run-status ────────────────────────────────────────────────── */}
      <StatusCard
        title="Dry-run-läge"
        active={dryRunEnabled}
        activeIcon={ShieldAlert}
        activeTone="amber"
        activeBody="Utkast genereras och loggas men skickas inte till kund. Använd godkännanden i Inkorgen för att träna AI:n innan ni slår på auto-svar."
        inactiveBody="AI:n behandlar inkommande mejl direkt. Inga simulerade utkast."
        statusLabelActive="AKTIVT — INGET SKICKAS"
        statusLabelInactive="INAKTIVT"
      />

      {/* ── Auto-send-status ──────────────────────────────────────────────── */}
      <StatusCard
        title="Auto-svar till kund"
        active={autoSendEnabled}
        activeIcon={CheckCircle2}
        activeTone="green"
        activeBody="AI:n får skicka svar direkt till kund när alla fyra villkor nedan är uppfyllda. Annars hamnar utkastet i Inkorgen för manuell granskning."
        inactiveBody="AI:n skapar bara utkast — en människa måste alltid godkänna innan något skickas till kund."
        statusLabelActive="PÅ — VILLKORLIG"
        statusLabelInactive="AV — ALLA UTKAST GRANSKAS"
      />

      {/* ── De fyra villkoren ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/60 p-5 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck size={16} className="text-primary mt-0.5" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-white">
              Krav för att AI:n får skicka automatiskt
            </h3>
            <p className="text-xs text-white/65 leading-relaxed mt-0.5">
              Även när auto-svar är på måste <strong>alla fyra</strong>{" "}
              villkoren uppfyllas för varje enskilt utkast. Annars hamnar
              det i Inkorgen för manuell granskning.
            </p>
          </div>
        </div>

        <ul className="space-y-2 pl-1">
          <Condition
            label={`AI:ns säkerhet ≥ ${AUTO_SEND_CONFIDENCE_THRESHOLD_PERCENT} %`}
            detail="Visas som grön &quot;auto-skickbar&quot;-pill på utkastet i Inkorgen."
          />
          <Condition
            label="Källgrundat svar"
            detail="AI:n måste citera minst en post i er kunskapsbas eller tidigare trådhistorik."
          />
          <Condition
            label="Låg risknivå"
            detail="Mejl klassade som höga eller medelhöga risker (klagomål, avtal, ekonomi) går alltid till manuell granskning."
          />
          <Condition
            label={`Återkommande kund (≥ ${MIN_INTERACTIONS_FOR_AUTOSEND} interaktioner)`}
            detail="Helt nya kunder får alltid en människa innan första svaret skickas."
          />
        </ul>
      </div>

      {/* ── Förklaring av iterationsmekaniken ─────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/40 p-5">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-white/55 mt-0.5 shrink-0" aria-hidden />
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Hur ni aktiverar auto-svar
            </h3>
            <ol className="text-xs text-white/70 leading-relaxed space-y-1 list-decimal pl-4">
              <li>Slå på <strong>Dry-run</strong> — AI:n börjar generera utkast utan att skicka.</li>
              <li>Granska minst 20 utkast i Inkorgen och godkänn eller redigera dem. AI:n lär sig er ton och era svar.</li>
              <li>När ni känner er trygga, kontakta Mailmind så aktiverar vi <strong>Auto-svar</strong> — men bara de utkast som klarar alla fyra villkor ovan skickas.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusCard({
  title,
  active,
  activeIcon: ActiveIcon,
  activeTone,
  activeBody,
  inactiveBody,
  statusLabelActive,
  statusLabelInactive,
}: {
  title:                string;
  active:               boolean;
  activeIcon:           React.ElementType;
  activeTone:           "green" | "amber";
  activeBody:           string;
  inactiveBody:         string;
  statusLabelActive:    string;
  statusLabelInactive:  string;
}) {
  const Icon  = active ? ActiveIcon : AlertTriangle;
  const tones = active
    ? activeTone === "green"
      ? { border: "border-green-500/25", bg: "bg-green-500/[0.05]", iconBg: "bg-green-500/10 border-green-500/25", iconColor: "text-green-400", badge: "bg-green-500/15 text-green-300 border-green-500/30" }
      : { border: "border-amber-500/30", bg: "bg-amber-500/[0.05]", iconBg: "bg-amber-500/10 border-amber-500/25", iconColor: "text-amber-400", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
    : { border: "border-white/10", bg: "bg-[hsl(var(--surface-elev-1))]/40", iconBg: "bg-white/[0.04] border-white/10", iconColor: "text-white/55", badge: "bg-white/[0.06] text-white/65 border-white/15" };

  return (
    <div className={`rounded-2xl border ${tones.border} ${tones.bg} p-5`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-xl border ${tones.iconBg} flex items-center justify-center`}>
          <Icon size={16} className={tones.iconColor} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${tones.badge}`}>
              {active ? statusLabelActive : statusLabelInactive}
            </span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed mt-1.5">
            {active ? activeBody : inactiveBody}
          </p>
        </div>
      </div>
    </div>
  );
}

function Condition({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 size={13} className="text-primary mt-0.5 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[11px] text-white/60 leading-relaxed">{detail}</p>
      </div>
    </li>
  );
}
