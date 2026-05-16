"use client";

/**
 * Data & Privacy controls — owner-only. Two actions:
 *   1. Download full data export (GDPR Article 20 — data portability)
 *   2. Request account deletion (30-day grace period, then permanent purge)
 *
 * If the org already has a pending deletion, show the countdown and
 * a "Cancel deletion" button instead.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { useToast, ToastContainer } from "@/components/ui/Toast";

type Props = {
  isOwner: boolean;
  orgName: string;
  deletionRequestedAt: Date | string | null;
};

export function DataPrivacy({ isOwner, orgName, deletionRequestedAt }: Props) {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();
  const [pending, setPending]   = useState<string | null>(null);
  const [confirm, setConfirm]   = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (!isOwner) return null;

  const pendingPurgeAt = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 30 * 24 * 3600 * 1000)
    : null;
  const daysLeft = pendingPurgeAt
    ? Math.max(0, Math.ceil((pendingPurgeAt.getTime() - Date.now()) / (24 * 3600 * 1000)))
    : 0;

  const downloadExport = async () => {
    setPending("export");
    try {
      const res = await fetch("/api/app/account/export");
      if (!res.ok) throw new Error("Kunde inte skapa export");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `mailmind-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export laddas ner.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const requestDeletion = async () => {
    if (confirmText !== orgName) {
      toast.error(`Skriv exakt "${orgName}" för att bekräfta.`);
      return;
    }
    setPending("delete");
    try {
      const res = await fetch("/api/app/account/delete", { method: "POST" });
      if (!res.ok) throw new Error("Kunde inte begära radering");
      toast.success("Raderingsbegäran skickad. 30 dagars grace-period börjar nu.");
      setConfirm(false);
      setConfirmText("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const cancelDeletion = async () => {
    setPending("cancel");
    try {
      const res = await fetch("/api/app/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte ångra radering");
      toast.success("Radering ångrad. Ditt konto är aktivt igen.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <h2 className="text-sm font-semibold uppercase tracking-widest text-white/30 px-1">
        Data & integritet
      </h2>

      {/* ── Export ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Download size={16} className="text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Exportera alla data</p>
            <p className="text-xs text-white/45 leading-relaxed mt-0.5">
              Ladda ner allt vi sparat om ditt företag som JSON — tråd­ar, meddelanden,
              utkast, inställningar, kunskapsbas, audit-logg. (GDPR art. 20)
            </p>
          </div>
        </div>
        <button
          onClick={downloadExport}
          disabled={pending === "export"}
          className="shrink-0 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors disabled:opacity-40"
        >
          {pending === "export" ? "Förbereder…" : "Ladda ner"}
        </button>
      </div>

      {/* ── Deletion ────────────────────────────────────────────────────── */}
      {deletionRequestedAt ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Kontot raderas om {daysLeft} dag{daysLeft !== 1 ? "ar" : ""}</p>
              <p className="text-xs text-white/55 leading-relaxed mt-0.5">
                Begäran inkom {new Date(deletionRequestedAt).toLocaleDateString("sv-SE")}.
                All data raderas permanent {pendingPurgeAt?.toLocaleDateString("sv-SE")}.
                Du kan ångra fram tills dess.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1 border-t border-red-500/15">
            <button
              onClick={cancelDeletion}
              disabled={pending === "cancel"}
              className="px-3.5 py-1.5 rounded-lg bg-white text-[#030614] text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-40"
            >
              {pending === "cancel" ? "Ångrar…" : "Ångra radering"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="text-red-400/80 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Radera konto och all data</p>
              <p className="text-xs text-white/45 leading-relaxed mt-0.5">
                Permanent radering av alla data efter 30 dagars grace-period.
                Klerk-användarkontot raderas inte — du kan logga in i en annan organisation efteråt.
              </p>
            </div>
            {!confirm && (
              <button
                onClick={() => setConfirm(true)}
                className="shrink-0 px-3.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors"
              >
                Radera konto
              </button>
            )}
          </div>

          {confirm && (
            <div className="space-y-3 pt-3 border-t border-white/5">
              <p className="text-xs text-white/60 leading-relaxed">
                Skriv organisationens namn{" "}
                <code className="text-white font-mono px-1.5 py-0.5 rounded bg-white/5">{orgName}</code>{" "}
                nedan för att bekräfta.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={orgName}
                className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-red-500/50 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setConfirm(false); setConfirmText(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={requestDeletion}
                  disabled={pending === "delete" || confirmText !== orgName}
                  className="px-3.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-400 transition-colors disabled:opacity-40"
                >
                  {pending === "delete" ? "Skickar…" : "Bekräfta radering"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
