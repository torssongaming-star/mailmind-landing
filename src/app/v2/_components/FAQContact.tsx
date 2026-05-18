"use client";

import { useState } from "react";
import { ChevronDown, ArrowRight, Mail, Check, Loader2 } from "lucide-react";

const FAQ = [
  {
    q: "Hur lång tid tar det att komma igång?",
    a: "Cirka 30 minuter för att koppla inkorg och köra onboarding. AI:n importerar er hemsida automatiskt så ni inte behöver mata in fakta manuellt.",
  },
  {
    q: "Skickas mejl automatiskt utan att vi godkänner?",
    a: "Nej. I standardläge måste ni godkänna varje svar. Auto-send kan aktiveras senare när ni gjort dry-run i 20 svar och ser att kvaliteten är hög, och endast på svar med ≥90% confidence.",
  },
  {
    q: "Var lagras våra data?",
    a: "I EU — Frankfurt (Neon Postgres). USA-leverantörer används bara för specifika ändamål (Stripe, Anthropic AI) och täcks av standardklausuler.",
  },
  {
    q: "Tränar ni AI på våra data?",
    a: "Nej. Anthropic Zero Data Retention är aktiverat — ert mejlinnehåll loggas inte och används inte för träning.",
  },
  {
    q: "Vad händer om AI:n inte vet svaret?",
    a: "Då eskaleras tråden med en intern sammanfattning till er säljare. AI:n säger aldrig saker den inte hittat i er kunskapsbas — den ber om hjälp istället.",
  },
  {
    q: "Kan jag säga upp när som helst?",
    a: "Ja. Inga bindningstider, inga uppsägningsavgifter. Ni kan exportera all data och radera kontot från app-inställningarna.",
  },
];

export function FAQContact() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="contact" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-16">

        {/* FAQ */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Vanliga frågor
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white mb-10">
            Bra svar
            <br />
            <span className="text-white/45">på bra frågor.</span>
          </h2>

          <div className="divide-y divide-white/8 border-t border-b border-white/8">
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-4 text-left group focus-visible:outline-none"
                  >
                    <span className="text-[15px] font-medium text-white group-hover:text-primary transition-colors">
                      {item.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={[
                        "text-white/40 shrink-0 transition-transform duration-200",
                        isOpen ? "rotate-180 text-primary" : "",
                      ].join(" ")}
                    />
                  </button>
                  <div
                    className={[
                      "grid transition-all duration-200",
                      isOpen ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0",
                    ].join(" ")}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm text-white/60 leading-relaxed max-w-prose">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact form */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <DemoRequestForm />
        </aside>

      </div>
    </section>
  );
}

// ── Demo request form ────────────────────────────────────────────────────────

function DemoRequestForm() {
  const [fullName, setFullName]       = useState("");
  const [workEmail, setWorkEmail]     = useState("");
  const [companyName, setCompanyName] = useState("");
  const [emailVolume, setEmailVolume] = useState("");
  const [message, setMessage]         = useState("");
  /** Honeypot field — bots fill this, humans never see it. */
  const [websiteUrl, setWebsiteUrl]   = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          workEmail,
          companyName,
          companyWebsite: "",
          emailVolume:    emailVolume || "Ej angivet",
          currentSystem:  "Ej angivet",
          message,
          websiteUrl, // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kunde inte skicka. Försök igen om en stund.");
        return;
      }
      setSent(true);
    } catch {
      setError("Kunde inte nå servern. Kontrollera din anslutning.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-[hsl(var(--surface-elev-1))]/40 to-[hsl(var(--surface-elev-1))]/40 p-6 backdrop-blur-sm shadow-[0_8px_40px_-12px_hsl(189_94%_43%/0.35)] text-center">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center mx-auto mb-4">
          <Check size={16} className="text-green-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Tack — vi hörs snart!</h3>
        <p className="text-xs text-white/55 mt-2 leading-relaxed">
          Vi återkommer inom en arbetsdag för att hitta en tid som passar er.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-[hsl(var(--surface-elev-1))]/40 to-[hsl(var(--surface-elev-1))]/40 p-6 backdrop-blur-sm shadow-[0_8px_40px_-12px_hsl(189_94%_43%/0.35)] space-y-3"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
          <Mail size={16} className="text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight leading-tight">Boka 20 min demo</h3>
          <p className="text-[11px] text-white/45 leading-tight mt-0.5">Inget säljsamtal — bara produkten.</p>
        </div>
      </div>

      <Field label="Namn">
        <input
          type="text"
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Anna Andersson"
          className="form-input"
        />
      </Field>

      <Field label="Jobbmejl">
        <input
          type="email"
          required
          value={workEmail}
          onChange={e => setWorkEmail(e.target.value)}
          placeholder="anna@bolag.se"
          className="form-input"
        />
      </Field>

      <Field label="Företag">
        <input
          type="text"
          required
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="Acme AB"
          className="form-input"
        />
      </Field>

      <Field label="Mejlvolym/dag (valfritt)">
        <select
          value={emailVolume}
          onChange={e => setEmailVolume(e.target.value)}
          className="form-input"
        >
          <option value="">Välj…</option>
          <option value="< 10">Under 10</option>
          <option value="10-50">10–50</option>
          <option value="50-200">50–200</option>
          <option value="200+">Över 200</option>
        </select>
      </Field>

      <Field label="Meddelande (valfritt)">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          placeholder="Vad vill ni se?"
          className="form-input resize-none"
        />
      </Field>

      {/* Honeypot — visually hidden, but bots will fill it */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={websiteUrl}
        onChange={e => setWebsiteUrl(e.target.value)}
        className="absolute -left-[9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {error && (
        <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 group inline-flex items-center justify-center gap-1.5 w-full h-11 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.45)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Skickar…
          </>
        ) : (
          <>
            Boka demo
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="text-[10px] text-white/35 text-center leading-relaxed">
        Vi återkommer inom en arbetsdag · ingen registrering krävs
      </p>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 9px 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          outline: none;
          transition: border-color 150ms;
          color-scheme: dark;
        }
        :global(.form-input::placeholder) {
          color: rgba(255, 255, 255, 0.25);
        }
        :global(.form-input:focus) {
          border-color: rgba(34, 211, 238, 0.4);
        }
        :global(.form-input option) {
          background: #0a0f1e;
          color: white;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
