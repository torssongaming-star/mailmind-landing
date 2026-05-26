/**
 * Genererar den formella avsiktsförklaringstexten som visas på /loi och
 * som lagras ordagrant i pre_launch_intents.intentText vid signering.
 *
 * Måste vara byte-identisk i UI och API — annars stämmer inte bevisningen.
 * Därför en delad helper, inte två separata templates.
 */

export type IntentTextInput = {
  name:    string;
  company: string;
};

export function generateIntentText({ name, company }: IntentTextInput): string {
  const safeName    = name.trim()    || "Undertecknad";
  const safeCompany = company.trim() || "företaget";

  return [
    `Jag, ${safeName}, företrädare för ${safeCompany}, avser att seriöst`,
    `utvärdera Mailmind vid lanseringen, och i förekommande fall teckna`,
    `abonnemang för ${safeCompany}.`,
    ``,
    `Denna avsiktsförklaring är inte juridiskt bindande och innebär inget`,
    `åtagande att slutföra köpet. Den är en daterad viljeyttring som`,
    `signalerar mitt aktiva intresse av att bli kund och hjälper Mailmind`,
    `förstå efterfrågan inför lansering.`,
  ].join("\n");
}
