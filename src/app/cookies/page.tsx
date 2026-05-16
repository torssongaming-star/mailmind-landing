import type { Metadata } from "next";
import Link from "next/link";
import { LegalNotice } from "../legal/LegalNotice";

export const metadata: Metadata = { title: "Cookies" };

type Cookie = {
  name:        string;
  category:    "strict" | "analytics" | "functional";
  provider:    string;
  purpose:     string;
  duration:    string;
};

const COOKIES: Cookie[] = [
  { name: "__clerk_db_jwt",      category: "strict", provider: "Clerk",         purpose: "Sessionsverifiering",                duration: "Session" },
  { name: "__client",            category: "strict", provider: "Clerk",         purpose: "Sessionsverifiering",                duration: "1 år" },
  { name: "__session",           category: "strict", provider: "Clerk",         purpose: "Sessionsverifiering",                duration: "Session" },
  { name: "mailmind_locale",     category: "functional", provider: "Mailmind",  purpose: "Sparar valt språk (sv/en)",          duration: "1 år" },
  { name: "_vercel_*",           category: "analytics", provider: "Vercel",     purpose: "Anonym sidstatistik & prestanda",    duration: "1 år" },
];

const COLOR: Record<string, string> = {
  strict:     "text-green-400 bg-green-500/10 border-green-500/20",
  functional: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  analytics:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const LABEL: Record<string, string> = {
  strict:     "Strikt nödvändig",
  functional: "Funktionell",
  analytics:  "Analys",
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Link href="/" className="text-xs uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
          ← Tillbaka till startsidan
        </Link>
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mt-8 mb-1">Policy</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Cookie-policy</h1>
        <p className="text-sm text-white/55">Version 1.0 · Gäller från [DATUM]</p>

        <div className="mt-6">
          <LegalNotice level="review" extra={
            <span>
              Granska att listan över cookies stämmer exakt med vad sajten faktiskt sätter
              (kör DevTools → Application → Cookies för att verifiera). Lägg till t.ex. Stripe-cookies
              om Stripe Checkout används.
            </span>
          } />
        </div>

        <div className="prose prose-invert max-w-none mt-8
          prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
          prose-p:text-white/75
          prose-strong:text-white
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-li:text-white/75
        ">
          <h2>Vad är cookies?</h2>
          <p>
            Cookies är små textfiler som webbplatser sparar på din enhet för att komma ihåg
            information mellan besök. Vissa är nödvändiga för att webbplatsen ska fungera,
            andra används för analys eller marknadsföring.
          </p>

          <h2>Cookies vi använder</h2>

          <div className="not-prose overflow-x-auto rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/50 my-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                  <th className="px-4 py-3 border-b border-white/8">Namn</th>
                  <th className="px-4 py-3 border-b border-white/8">Kategori</th>
                  <th className="px-4 py-3 border-b border-white/8">Leverantör</th>
                  <th className="px-4 py-3 border-b border-white/8">Syfte</th>
                  <th className="px-4 py-3 border-b border-white/8">Varaktighet</th>
                </tr>
              </thead>
              <tbody>
                {COOKIES.map(c => (
                  <tr key={c.name} className="border-b border-white/5 last:border-b-0">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-300">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ${COLOR[c.category]}`}>
                        {LABEL[c.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/70">{c.provider}</td>
                    <td className="px-4 py-3 text-white/70 text-xs">{c.purpose}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{c.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Kategorier</h2>
          <h3>Strikt nödvändiga</h3>
          <p>
            Krävs för att tjänsten ska fungera (inloggning, sessioner). Kan inte stängas av.
            Lagras enligt ePrivacy-direktivets undantag för &quot;tekniskt nödvändigt&quot;.
          </p>

          <h3>Funktionella</h3>
          <p>
            Kommer ihåg dina inställningar (t.ex. språkval). Förbättrar upplevelsen men är
            inte strikt nödvändiga. Kräver samtycke.
          </p>

          <h3>Analys</h3>
          <p>
            Hjälper oss förstå hur webbplatsen används (anonymt). Inga cookies med personlig
            spårning. Kräver samtycke.
          </p>

          <h2>Ändra ditt val</h2>
          <p>
            Du kan när som helst ändra ditt samtycke genom att klicka på <b>&quot;Cookie-inställningar&quot;</b>
            i sidfoten. Du kan också blockera cookies via din webbläsares inställningar.
          </p>

          <h2>Tredjepartstjänster</h2>
          <p>
            Vissa cookies sätts av tredje part:
          </p>
          <ul>
            <li><a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer">Clerk (autentisering)</a></li>
            <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel (hosting & analys)</a></li>
            <li><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe (vid betalning)</a></li>
          </ul>

          <h2>Kontakt</h2>
          <p>
            Frågor om cookies? <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a>
          </p>
        </div>
      </div>
    </main>
  );
}
