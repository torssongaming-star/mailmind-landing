"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createPilotLeadAction } from "@/lib/admin/actions";

type OrgStatus = "internal_test" | "pilot" | "active_customer" | "enterprise_lead" | "enterprise_customer" | "churned";

export function NewPilotModal() {
  const [open,         setOpen]         = useState(false);
  const [ownerName,    setOwnerName]    = useState("");
  const [contactName,  setContactName]  = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [summary,      setSummary]      = useState("");
  const [status,       setStatus]       = useState<OrgStatus>("enterprise_lead");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const reset = () => {
    setOwnerName(""); setContactName(""); setContactEmail("");
    setSummary(""); setStatus("enterprise_lead"); setError(null);
  };

  const close = () => { reset(); setOpen(false); };

  const submit = async () => {
    if (!ownerName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createPilotLeadAction({ ownerName, contactName, contactEmail, summary, status });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
      >
        New Pilot Lead
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#050B1C] border border-white/10 rounded-2xl shadow-2xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">New Pilot Lead</h2>
                <button onClick={close} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <Field label="Företagsnamn *">
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="Acme AB"
                    className="input-field"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Kontaktperson">
                    <input
                      type="text"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder="Anna Svensson"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Kontakt-e-post">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      placeholder="anna@acme.se"
                      className="input-field"
                    />
                  </Field>
                </div>

                <Field label="Status">
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as OrgStatus)}
                    className="input-field appearance-none"
                  >
                    <option value="enterprise_lead">Enterprise Lead</option>
                    <option value="pilot">Pilot</option>
                    <option value="internal_test">Internal Test</option>
                    <option value="active_customer">Active Customer</option>
                    <option value="enterprise_customer">Enterprise Customer</option>
                    <option value="churned">Churned</option>
                  </select>
                </Field>

                <Field label="Sammanfattning">
                  <textarea
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    placeholder="Kort context om leadet, källa, varför de är intressanta…"
                    rows={3}
                    className="input-field resize-none"
                  />
                </Field>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={close}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Avbryt
                </button>
                <button
                  onClick={submit}
                  disabled={saving || !ownerName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-black hover:bg-cyan-300 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  {saving ? "Sparar…" : "Skapa lead"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .input-field {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          color: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: rgba(6,182,212,0.4);
        }
        .input-field::placeholder {
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</label>
      {children}
    </div>
  );
}
