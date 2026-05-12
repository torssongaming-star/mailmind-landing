"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { upsertOrgProfileAction } from "@/lib/admin/actions";

type OrgStatus = "internal_test" | "pilot" | "active_customer" | "enterprise_lead" | "enterprise_customer" | "churned";

const STATUS_OPTIONS: { value: OrgStatus; label: string }[] = [
  { value: "internal_test",      label: "Internal Test"      },
  { value: "pilot",              label: "Pilot"              },
  { value: "active_customer",    label: "Active Customer"    },
  { value: "enterprise_lead",    label: "Enterprise Lead"    },
  { value: "enterprise_customer",label: "Enterprise Customer"},
  { value: "churned",            label: "Churned"            },
];

export function OrgProfilePanel({
  orgId,
  initialStatus,
}: {
  orgId:         string;
  initialStatus: OrgStatus | null;
}) {
  const [status,  setStatus]  = useState<OrgStatus>(initialStatus ?? "internal_test");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await upsertOrgProfileAction(orgId, { status });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-3 items-center">
      <select
        value={status}
        onChange={e => setStatus(e.target.value as OrgStatus)}
        className="bg-[#050B1C] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none"
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 min-w-[140px] justify-center"
      >
        {saving  && <Loader2 className="w-3 h-3 animate-spin" />}
        {saved   && <Check   className="w-3 h-3" />}
        {saving ? "Sparar…" : saved ? "Sparat!" : "Update Profile"}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
