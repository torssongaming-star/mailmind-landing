/**
 * Construction-vertical prompt fragments for the AI authoring layer.
 *
 * Injected into the system prompt by the construction AI-draft route before
 * calling draftQuote(). Pure data — no DB/app imports.
 */

const VOCABULARY_FRAGMENT = `BYGG-TERMINOLOGI (använd svenska termer):
- Projekt = typ av arbete (t.ex. badrumsrenovering, takbyte, tillbyggnad)
- Yta = m² som berörs
- Materialkostnad = pris per m² exkl. moms
- Arbetskostnad = timmar × timpris exkl. moms
- Moms = 25 % på material + arbete
- ROT-avdrag = skattereduktion 30 % på arbetskostnad (max 50 000 kr/person/år)`;

const CALCULATION_FRAGMENT = `BERÄKNINGSKONVENTIONER:
- Priser och summor SKA lämnas tomma i narrativeText — de fylls i av beräkningsmotorn.
- Föreslå konkreta motor-inputs i proposedInputs: projectType, areaM2, materialCostSekPerM2, labourHours, labourRateSekPerHour, includeRot.
- Om yta saknas i briefen — flagga "missing_area" i riskFlags.
- Om arbetsomfång (timmar) saknas — flagga "missing_labour" i riskFlags.
- Anta aldrig materialpriser som inte framgår — flagga "missing_material_cost".`;

const STYLE_FRAGMENT = `NARRATIV STIL:
- Skriv vänligt och professionellt i andra person (du/er).
- Bekräfta kort vad projektet omfattar.
- Beskriv arbetsmoment baserat på briefen.
- Avsluta med utrymme för nyckeltal: "Enligt vår kalkyl uppgår arbetet till [TOTAL] kr efter ROT-avdrag."
- Använd platshållaren exakt — beräkningsmotorn ersätter den.`;

const ROT_FRAGMENT = `ROT-AVDRAG:
- Nämn alltid ROT-avdraget om inget tyder på att kunden är ett företag.
- Formulering: "ROT-avdraget reducerar arbetskostnaden med 30 %, upp till 50 000 kr per person och år."`;

export const CONSTRUCTION_PROMPT_FRAGMENTS: string[] = [
  VOCABULARY_FRAGMENT,
  CALCULATION_FRAGMENT,
  STYLE_FRAGMENT,
  ROT_FRAGMENT,
];

export function getConstructionPromptFragments(): string[] {
  return CONSTRUCTION_PROMPT_FRAGMENTS;
}
