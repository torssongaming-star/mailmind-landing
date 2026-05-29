/**
 * Solar-vertical prompt fragments for the AI authoring layer.
 *
 * These fragments are injected into the system prompt by the solar
 * AI-draft route before calling draftQuote(). They encode vertical-specific
 * vocabulary, calculation conventions, and output expectations.
 *
 * Design:
 *   - Pure data — no imports from @/lib/db or @/lib/app.
 *   - Arrays so individual fragments can be composed / overridden by tests.
 *   - Exports: SOLAR_PROMPT_FRAGMENTS (all fragments) + getSolarPromptFragments()
 *     (future: per-org overrides can be injected here).
 */

// ── Vocabulary ────────────────────────────────────────────────────────────────

const VOCABULARY_FRAGMENT = `SOLCELLS-TERMINOLOGI (använd alltid dessa svenska termer):
- Systemstorlek = kWp (kilowatt-peak)
- Årsproduktion = uppskattad kWh per år baserat på takytor
- Egenanvändning = den andel av produktionen som används direkt i huset
- Överskott = el som matas ut på nätet (ersätts via nätavräkning)
- ROI = återbetalningstid i år
- ROT-avdrag = skattereduktion 30 % på arbetskostnad (max 50 000 kr/person/år)
- NPV = nuvärde av investering över 25 år
- IRR = internränta`;

// ── Calculation conventions ───────────────────────────────────────────────────

const CALCULATION_FRAGMENT = `BERÄKNINGSKONVENTIONER:
- Prisuppgifter och kWh-tal SKA lämnas tomma i narrativeText — de fylls i av beräkningsmotorn.
- Föreslå dock konkreta motor-inputs i proposedInputs: kvp (systemstorlek), roofAzimuth (0=N, 180=S), roofTilt (grader), consumption (kWh/år), systemCost (SEK exkl. ROT).
- Om takytans orientering eller storlek saknas i briefen — flagga "missing_roof_details" i riskFlags.
- Om årsförbrukning saknas — flagga "missing_consumption" i riskFlags.
- Anta aldrig specifika priser — lägg "missing_system_cost" i riskFlags om kostnaden inte nämns.`;

// ── Narrative style ───────────────────────────────────────────────────────────

const STYLE_FRAGMENT = `NARRATIV STIL:
- Skriv i andra person (du/er), vänligt och professionellt.
- Inled med en kort bekräftelse av kundens situation.
- Beskriv systemet (orientering, uppskattad storlek) baserat på briefen.
- Avsluta med ett utrymme för nyckeltal: "Enligt vår beräkning producerar systemet [PRODUKTION] kWh/år med en återbetalningstid på [ATERBET] år."
- Använd platshållaren exakt som ovan — beräkningsmotorn ersätter dem.`;

// ── ROT reminder ─────────────────────────────────────────────────────────────

const ROT_FRAGMENT = `ROT-AVDRAG:
- Nämn alltid ROT-avdraget om inget i briefen indikerar att kunden är ett företag.
- Formulering: "ROT-avdraget reducerar er arbetskostnad med 30 %, upp till 50 000 kr per person och år."
- Flagga INTE missing_rot om det inte nämns i briefen — ROT är standard för privatpersoner.`;

// ── Exported fragments ────────────────────────────────────────────────────────

export const SOLAR_PROMPT_FRAGMENTS: string[] = [
  VOCABULARY_FRAGMENT,
  CALCULATION_FRAGMENT,
  STYLE_FRAGMENT,
  ROT_FRAGMENT,
];

/**
 * Returns the solar prompt fragments array.
 * Placeholder for future per-org customisation (e.g. inject org-specific
 * pricing norms or style overrides without changing the core fragments).
 */
export function getSolarPromptFragments(): string[] {
  return SOLAR_PROMPT_FRAGMENTS;
}
