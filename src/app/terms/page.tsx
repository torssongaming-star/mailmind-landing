import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Användarvillkor" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))] text-white">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Tillbaka till startsidan
        </Link>

        <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Avtal</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Användarvillkor</h1>
        <p className="text-sm text-white/55">Version 2.0 · Senast uppdaterad: [DATUM]</p>

        <div className="prose prose-invert max-w-none mt-10
          prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
          prose-p:text-white/75 prose-p:leading-relaxed
          prose-strong:text-white
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-li:text-white/75 prose-li:my-1
        ">

          <h2>1. Parter och godkännande</h2>
          <p>
            Dessa villkor (&quot;Villkoren&quot;) gäller mellan dig (&quot;Kund&quot; — privatperson som
            agerar i tjänsten som anställd hos en juridisk person) och <b>[BOLAGSNAMN AB]</b>,
            org-nr [XXXXXX-XXXX] (&quot;{siteConfig.siteName}&quot;).
          </p>
          <p>
            Genom att registrera dig, logga in eller använda tjänsten godkänner du Villkoren samt:
          </p>
          <ul>
            <li><Link href="/legal/aup">Acceptabel användning (AUP)</Link></li>
            <li><Link href="/privacy">Integritetspolicy</Link></li>
            <li><Link href="/cookies">Cookie-policy</Link></li>
            <li><Link href="/legal/dpa">Personuppgiftsbiträdesavtal (DPA)</Link> (om du behandlar tredje parts persondata)</li>
          </ul>

          <h2>2. Tjänsten</h2>
          <p>
            {siteConfig.siteName} är en B2B-SaaS som hjälper team att hantera e-postsupport
            med stöd av artificiell intelligens. Tjänsten inkluderar bland annat: mottagning av
            inkommande mejl, AI-genererade svarsförslag, ärendehantering och statistik.
          </p>

          <h2>3. Konto</h2>
          <ul>
            <li>Du måste vara minst 18 år och behörig att binda din arbetsgivare för att registrera ett konto</li>
            <li>Du ansvarar för att kontouppgifter hanteras säkert och inte delas</li>
            <li>Du är ansvarig för all aktivitet under ditt konto</li>
            <li>Vid misstänkt obehörig åtkomst kontakta omedelbart <a href="mailto:security@mailmind.se">security@mailmind.se</a></li>
          </ul>

          <h2>4. Provperiod</h2>
          <p>
            Nya kunder får 14 dagars provperiod utan kostnad. Provperioden börjar vid registrering.
            Inga avgifter debiteras under provperioden om inte du själv aktiverar betalt abonnemang.
          </p>

          <h2>5. Avgifter och betalning</h2>
          <ul>
            <li>Avgifter framgår av prissidan vid tidpunkt för registrering</li>
            <li>Moms tillkommer (25%) för svenska kunder</li>
            <li>Fakturering månadsvis eller årsvis enligt val</li>
            <li>Auto-renewal: månadsabonnemang förnyas automatiskt månadsvis, årsabonnemang årsvis</li>
            <li>Vid utebliven betalning: påminnelse efter 7 dagar, eventuell avstängning efter 14 dagar</li>
            <li>Prisförändringar: meddelas minst 60 dagar i förväg</li>
          </ul>
          <p>
            Se separat <Link href="/legal/refund">Återbetalningspolicy</Link>.
          </p>

          <h2>6. Acceptabel användning</h2>
          <p>
            Du förbinder dig att följa vår <Link href="/legal/aup">Acceptable Use Policy</Link>.
            Brott mot AUP kan leda till avstängning eller uppsägning av kontot utan återbetalning.
          </p>

          <h2>7. AI-genererat innehåll</h2>
          <ul>
            <li>AI-svar är <b>förslag</b> — du ansvarar för att granska och godkänna innan utskick</li>
            <li>Auto-send är endast tillgängligt efter att dry-run-tröskel uppfyllts och kräver explicit aktivering</li>
            <li>{siteConfig.siteName} garanterar inte att AI-svar är korrekta, fullständiga eller lämpliga</li>
            <li>Du ansvarar för allt innehåll som skickas via tjänsten — även AI-genererat</li>
          </ul>

          <h2>8. Immateriella rättigheter</h2>
          <ul>
            <li><b>Du äger din data</b>: trådar, kontakter, kunskapsbas, inställningar</li>
            <li><b>{siteConfig.siteName} äger plattformen</b>: kod, design, varumärken, AI-prompter</li>
            <li>Du ger oss en begränsad licens att använda din data endast för att leverera tjänsten</li>
            <li>Vi tränar INTE AI-modeller på dina data</li>
          </ul>

          <h2>9. Personuppgifter och GDPR</h2>
          <p>
            För persondata som du lägger in i tjänsten är du personuppgiftsansvarig och vi är
            personuppgiftsbiträde. Vårt <Link href="/legal/dpa">DPA</Link> ingår som en del
            av Villkoren. Vår <Link href="/legal/sub-processors">underbiträdes-lista</Link> är
            tillgänglig publikt och uppdateras vid förändring.
          </p>

          <h2>10. Servicenivå</h2>
          <p>
            Vi följer publicerade <Link href="/legal/sla">SLA-nivåer</Link>. Vid brott mot
            SLA kan du begära servicekredit.
          </p>

          <h2>11. Säkerhet</h2>
          <p>
            Vi tillämpar branschstandard-säkerhet enligt vår <Link href="/security">Säkerhetspolicy</Link>:
            kryptering i vila och under överföring, multi-tenant-isolering, rollbaserad åtkomst,
            audit-loggning. Inga garantier kan dock lämnas för perfekt säkerhet.
          </p>

          <h2>12. Uppsägning</h2>
          <ul>
            <li>Du kan säga upp ditt konto när som helst via <code>/app/settings/account</code></li>
            <li>Vid uppsägning behåller du åtkomst till tjänsten under resten av faktureringsperioden</li>
            <li>Efter uppsägning: 30 dagars grace med dataexport-möjlighet, sedan permanent radering</li>
            <li>Vi kan säga upp avtalet vid AUP-brott eller utebliven betalning</li>
          </ul>

          <h2>13. Ansvarsbegränsning</h2>
          <p>
            🚨 [SAMRÅD ADVOKAT] Ansvarsbegränsning är juridiskt känslig.
            Förslag:
          </p>
          <ul>
            <li>{siteConfig.siteName}s totala ansvar är begränsat till de avgifter du betalat under de senaste 12 månaderna</li>
            <li>Inget ansvar för indirekta skador, följdskador eller utebliven vinst</li>
            <li>Undantag: grov oaktsamhet, uppsåt, brott mot dataskydd</li>
          </ul>

          <h2>14. Ändringar i Villkoren</h2>
          <p>
            Större ändringar meddelas via e-post minst 30 dagar i förväg. Mindre förtydliganden
            träder i kraft vid publicering. Du har alltid rätt att säga upp avtalet utan kostnad
            inom 30 dagar efter förändring som påverkar dig negativt.
          </p>

          <h2>15. Tillämplig lag</h2>
          <p>
            Svensk lag tillämpas. Tvister ska i första hand lösas genom förhandling. Vid utebliven
            lösning avgörs tvist av svensk allmän domstol med Stockholms tingsrätt som första instans.
          </p>
          <p className="text-sm">
            🚨 [ADVOKATFRÅGA] Alternativt skiljedom enligt SCC för B2B — diskutera med advokat
            vilken som passar er målgrupp.
          </p>

          <h2>16. Kontakt</h2>
          <ul>
            <li>Support: <a href={`mailto:${siteConfig.supportEmail ?? "support@mailmind.se"}`}>{siteConfig.supportEmail ?? "support@mailmind.se"}</a></li>
            <li>Fakturering: <a href="mailto:billing@mailmind.se">billing@mailmind.se</a></li>
            <li>Dataskydd: <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a></li>
            <li>Säkerhet: <a href="mailto:security@mailmind.se">security@mailmind.se</a></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
