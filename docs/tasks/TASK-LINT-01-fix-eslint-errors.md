# TASK-LINT-01 — Fixa alla ESLint-fel i kodbasen

**Status:** Open  
**Typ:** Underhåll / kodkvalitet  
**Prioritet:** Medel  
**Tilldelad:** Antigravity

---

## 1. Goal

Åtgärda samtliga 51 ESLint-fel så att `npm run lint` och `npm run typecheck` passerar utan fel.
Produktens beteende, UI, databas-schema och API-kontrakt ska vara **identiska** före och efter.

---

## 2. Context

Kodbasen har ackumulerat lint-fel av tre typer:

| Typ | Antal | Exempel |
|-----|-------|---------|
| `@typescript-eslint/no-unused-vars` | ~17 | Oanvända imports av ikoner, variabler |
| `@typescript-eslint/no-explicit-any` | ~27 | `any`-typer i admin-sidor och lib-filer |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | ~6 | `foo?.bar!` — farligt mönster |
| `@typescript-eslint/ban-ts-comment` | 1 | `@ts-ignore` ska bytas till `@ts-expect-error` |

Felen är koncentrerade till admin-sidor och lib-filer. Appens kärnflöde (portal, AI, webhooks) är i stort sett rent.

Nuläge kördes **2026-05-10** och gav exakt följande utdata:

```
51 problems (51 errors, 0 warnings)
```

Berörda filer (fullständig lista från lint-körning):

```
src/app/(admin)/admin/audit/page.tsx
src/app/(admin)/admin/knowledge/[id]/page.tsx
src/app/(admin)/admin/knowledge/page.tsx
src/app/(admin)/admin/organizations/[id]/page.tsx
src/app/(admin)/admin/organizations/page.tsx
src/app/(admin)/admin/pilots/page.tsx
src/app/(admin)/admin/users/[id]/page.tsx
src/app/(admin)/admin/users/page.tsx
src/app/(portal)/app/inbox/page.tsx
src/app/api/admin/knowledge/[id]/route.ts
src/app/api/admin/knowledge/route.ts
src/app/api/admin/users/[id]/password-reset/route.ts
src/app/api/app/knowledge/scrape/route.ts
src/app/api/cron/usage-warning/route.ts
src/components/admin/KnowledgeEditor.tsx
src/components/admin/KnowledgeFilters.tsx
src/components/layout/Providers.tsx
src/components/portal/Sidebar.tsx
src/lib/admin/actions.ts
src/lib/admin/queries.ts
src/lib/app/threads.ts
```

---

## 3. Files to inspect first

Läs dessa filer innan du börjar skriva kod:

1. `package.json` — kontrollera befintliga paket och scripts
2. `.eslintrc.*` / `eslint.config.*` — förstå aktiva regler
3. `src/lib/admin/queries.ts` — mest komplexa filen (5 fel inkl. `@ts-ignore`)
4. `src/app/api/admin/knowledge/route.ts` — 6 fel inkl. farliga `!`-assertions
5. `src/app/api/admin/knowledge/[id]/route.ts` — 3 fel inkl. farliga `!`-assertions

---

## 4. Allowed changes

- Ta bort oanvända imports och variabler.
- Ersätt `any` med konkret typ, `unknown`, eller smalast möjliga union.
- Ersätt `foo?.bar!` med explicit null-check (`if (!foo?.bar) return`) eller tidig `throw`.
- Byt `@ts-ignore` mot `@ts-expect-error` med en förklarande kommentar på raden ovanför.
- Om en `any`-typ i en API-route är nödvändig på grund av extern SDK utan typer: lägg till `// eslint-disable-next-line @typescript-eslint/no-explicit-any` med motivering på raden ovanför — **inte** filnivå-disable.

---

## 5. Not allowed

- Inga ändringar i `src/lib/db/schema.ts` eller migrationer.
- Inga ändringar i API-kontrakten (request/response-format).
- Inga ändringar i UI-layout, text eller stilar.
- Inga nya npm-paket.
- Inga filnivå `/* eslint-disable */`-kommentarer som döljer flera fel på en gång.
- Inga ändringar i filer som inte finns med i fellistan ovan.
- Rör inte `.env*`-filer.

---

## 6. Acceptance criteria

- [ ] `npm run lint` avslutas med exit code 0 och noll fel
- [ ] `npm run typecheck` avslutas med exit code 0 (undantaget det befintliga `.next/types`-felet om `dashboard/overview/page.js` — det är en cache-artefakt som inte berörs av denna task)
- [ ] `npm run build` passerar (kräver placeholder `.env.local`)
- [ ] Ingen produktionsfunktionalitet är ändrad
- [ ] PR-beskrivningen listar varje ändrad fil och vilken typ av fix som gjordes
- [ ] Inga `eslint-disable`-kommentarer på filnivå har lagts till

---

## 7. Manual test steps

Eftersom tasken enbart berör typer och oanvända imports krävs ingen manuell testning av UI-flöden. Verifiera ändå att:

1. `npm run dev` startar utan fel i terminalen
2. `/app/inbox` laddar (säkerställer att `Link`-import-fixet i `inbox/page.tsx` inte bröt något)
3. `/admin` laddar (säkerställer att admin-sidornas `any`-fixar inte bröt renders)
4. Bifoga terminalutskrift från `npm run lint` och `npm run typecheck` som artifact i PR:en

---

## 8. Security / multi-tenant review focus

Tre av felen är av säkerhetsrelevant karaktär och kräver extra noggrannhet:

| Fil | Rad | Problem | Vad att kontrollera |
|-----|-----|---------|---------------------|
| `src/app/api/admin/knowledge/route.ts` | 43–50 | `?.!`-assertions | Ersätt med explicit guard. Om värdet kan vara `null` ska routen returnera 400/404, inte krascha med runtime-fel |
| `src/app/api/admin/knowledge/[id]/route.ts` | 52–53 | `?.!`-assertions | Samma som ovan |
| `src/app/api/admin/users/[id]/password-reset/route.ts` | 39–40 | `?.!`-assertions | Lösenordsåterställning — säkerställ att null-check inte öppnar för att routen körs utan giltig användare |

För `any`-typer i admin-queries (`src/lib/admin/queries.ts`): säkerställ att den typ du sätter inte breddar vad som accepteras som `organizationId` eller liknande fält — ingen ny data ska kunna nå DB utan att vara `organizationId`-scopad.
