import type { Metadata } from "next";
import { LegalNotice } from "../LegalNotice";

export const metadata: Metadata = { title: "Återbetalningspolicy" };

export default function RefundPage() {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Policy</p>
      <h1>Återbetalningspolicy</h1>
      <p className="text-sm text-white/55 mt-1">Version 1.0 · Gäller från [DATUM]</p>

      <LegalNotice level="review" extra={
        <span>Granska att återbetalningsperioder och undantag stämmer med er verksamhet.
        Specifikt: 14 dagars ångerrätt är konsumenträtt — gäller normalt inte B2B men kan
        vara generös marknadsföring.</span>
      } />

      <h2>1. Provperiod</h2>
      <p>
        Nya kunder får en provperiod på <b>14 dagar</b> utan kostnad. Provperioden börjar vid
        registrering och avslutas automatiskt om ingen betalmetod lagts till.
      </p>
      <p>
        Om en betalmetod läggs till under provperioden debiteras första månaden när provperioden
        löper ut. Du kan avbryta provperioden när som helst via kontoadministrationen utan att
        debiteras.
      </p>

      <h2>2. Månadsabonnemang</h2>
      <ul>
        <li>Månadsabonnemang förnyas automatiskt varje månad</li>
        <li>Uppsägning träder i kraft vid slutet av pågående faktureringsperiod</li>
        <li>Inga återbetalningar för pågående månad</li>
        <li>Vid uppsägning behåller du åtkomst till tjänsten under resten av faktureringsperioden</li>
      </ul>

      <h2>3. Årsabonnemang</h2>
      <ul>
        <li>Årsabonnemang ger 17% rabatt jämfört med månadsbetalning</li>
        <li><b>Pro-rata-återbetalning</b> vid uppsägning inom 30 dagar från startdatum eller förnyelse</li>
        <li>Efter 30 dagar: ingen återbetalning för outnyttjad tid</li>
        <li>Vid downgrade: rabatt-justering träder i kraft vid nästa förnyelse</li>
      </ul>

      <h2>4. Avbruten provperiod till betalt konto</h2>
      <p>
        Om du har debiterats för första månaden men ångrar dig inom <b>7 dagar</b> efter
        provperiodens slut, återbetalar vi månadsavgiften i sin helhet under förutsättning att:
      </p>
      <ul>
        <li>Mindre än 100 AI-utkast har genererats</li>
        <li>Inget mejl har skickats via tjänsten</li>
        <li>Begäran inkommer skriftligen via <a href="mailto:billing@mailmind.se">billing@mailmind.se</a></li>
      </ul>

      <h2>5. Servicekredit (SLA)</h2>
      <p>
        Vid brott mot vårt <a href="/legal/sla">SLA</a> kan du begära servicekredit som dras från
        nästa faktura. Servicekredit ges inte som kontant återbetalning.
      </p>

      <h2>6. Avstängning vid AUP-brott</h2>
      <p>
        Vid avstängning eller uppsägning på grund av brott mot vår{" "}
        <a href="/legal/aup">Acceptable Use Policy</a> återbetalas inga avgifter.
      </p>

      <h2>7. Hur du begär återbetalning</h2>
      <ol>
        <li>Mejla <a href="mailto:billing@mailmind.se">billing@mailmind.se</a> från den e-postadress som är registrerad på kontot</li>
        <li>Ange faktura-nr eller faktureringsdatum</li>
        <li>Beskriv kort orsaken (för intern uppföljning)</li>
        <li>Vi svarar inom 3 arbetsdagar och bekräftar om återbetalning beviljas</li>
        <li>Beviljad återbetalning syns på betalkortet inom 5–10 bankdagar</li>
      </ol>

      <h2>8. Övriga frågor</h2>
      <p>
        Kontakta <a href="mailto:billing@mailmind.se">billing@mailmind.se</a> för alla
        faktureringsfrågor. Vi gör vårt bästa för att vara rimliga vid genuina problem.
      </p>
    </>
  );
}
