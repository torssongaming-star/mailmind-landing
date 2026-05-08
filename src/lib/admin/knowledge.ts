export interface KnowledgeArticle {
  id: string;
  category: string;
  title: string;
  content: string;
}

export const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: "enterprise-process",
    category: "Processes",
    title: "Enterprise Sales Process",
    content: `
### Vilka frågor vi ska ställa
- Hur många inkomna mail har ni per dag?
- Vilka system använder ni idag (Zendesk, Salesforce, etc.)?
- Vad är er största pain point i kundtjänst idag?

### Vad kunden behöver
- Tydlig ROI-kalkyl.
- Säkerhetsgenomgång (SOC2/GDPR).
- Pilotperiod på 30 dagar.

### Vad vi kan lova idag
- Integration med Gmail/Outlook.
- AI-drafting på svenska och engelska.
- Mänsklig granskning före utskick.

### Vad som kräver anpassning
- Direkt integration i specialbyggda CRM.
- Lokal installation (On-prem).
    `.trim(),
  },
  {
    id: "gdpr-security",
    category: "Security",
    title: "GDPR & Security FAQ",
    content: `
### Var data lagras
- All data lagras inom EU (Tyskland/Belgien) via Neon (PostgreSQL) och Google Cloud.

### Tränas AI på kunddata?
- Nej. Vi använder Anthropic Claude via API med "zero retention"-policy. Ingen kunddata används för att träna basmodeller.

### Hur radering fungerar
- När en organisation raderas i Mailmind tas all data bort permanent från våra produktionsdatabaser inom 24 timmar.

### Vem hos Mailmind har åtkomst?
- Endast behörig personal via internt admin-system (detta system). Alla åtkomster loggas.
    `.trim(),
  },
  {
    id: "pilot-checklist",
    category: "Checklists",
    title: "Pilot Customer Checklist",
    content: `
1. **Kick-off**: Identifiera kontaktperson och teknisk ägare.
2. **Setup**: Anslut minst en delad inbox.
3. **Training**: Genomgång av hur AI-drafts granskas.
4. **Baseline**: Mät nuvarande svarstid (Time to Response).
5. **Follow-up**: Veckovisa avstämningar under 4 veckor.
6. **Decision**: Utvärdering efter pilotens slut för övergång till betald plan.
    `.trim(),
  },
];
