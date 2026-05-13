# TASK-BUILD-01 — Verifiera och säkra produktionsbygget

**Status:** Open  
**Typ:** Underhåll / byggkvalitet  
**Prioritet:** Hög  
**Tilldelad:** Antigravity

---

## 1. Goal

Verifiera att Mailmind bygger rent för produktion och dokumentera samtliga blockers. Fixa **endast** faktiska build-blockers — inga nya features, ingen UI-förändring, inga nya paket utan godkännande.

---

## 2. Context

Build kördes **2026-05-10** och gav följande resultat:

```
✓ Compiled successfully in 5.7s
✓ TypeScript passed in 6.5s
✓ 47 static pages generated
✓ Build completed — 0 errors
```

Bygget passerar idag. Det finns dock tre observationer som kräver åtgärd eller bekräftelse:

### Observation 1 — Deprecated middleware-konvention (varning)
```
⚠ The "middleware" file convention is deprecated.
  Please use "proxy" instead.
```
Antigravity har bytt `proxy.ts` → `middleware.ts` i sin lint-fix (commit `997aab7`). Next.js 16 verkar nu varna för att `middleware.ts` är det _gamla_ konventionsnamnet och att projektet ska använda `proxy.ts`. Filen har alltså bytt namn i fel riktning. Kontrollera och åtgärda.

### Observation 2 — Enterprise price ID saknas (loggar vid build)
```
priceIds: { starter: 'valid_format', team: 'valid_format', business: 'valid_format', enterprise: 'missing' }
```
`STRIPE_PRICE_ID_ENTERPRISE` är inte satt i `.env.local` eller Vercel. Eftersom ingen plan heter `enterprise` i `src/lib/plans.ts` är detta sannolikt ett skräpvärde i koden — verifiera och städa bort om det inte används.

### Observation 3 — `.next/types`-cache-artefakt (typecheck-fel)
```
.next/types/validator.ts(152,39): error TS2307:
  Cannot find module '../../src/app/(portal)/dashboard/overview/page.js'
```
Filen `dashboard/overview` existerar inte i repot. Det är en gammal `.next`-cache som inte rensats. Lös genom `rm -rf .next` (eller Windows-ekvivalent) och verifiera att typecheck är ren efteråt.

---

## 3. Files to inspect first

1. `.claude/context/project-state.md` — nuläge
2. `package.json` — scripts och beroenden
3. `docs/roadmap/mailmind-sverige-mvp.md` — låsta beslut
4. `src/middleware.ts` (eller `src/proxy.ts`) — se observation 1
5. `src/lib/stripe.ts` — se observation 2, `PRICE_IDS`-objektet
6. `src/lib/plans.ts` — verifiera att `enterprise` inte är en aktiv plan

---

## 4. Allowed changes

- Återställ filnamnet `middleware.ts` → `proxy.ts` om det bekräftas att projektet använder `proxy.ts`-konventionen (se observation 1)
- Ta bort `enterprise`-nyckeln ur `PRICE_IDS` i `src/lib/stripe.ts` om den inte används
- Rensa `.next`-cache för att eliminera typecheck-artefakten
- Mindre typfixar som blockerar `npm run typecheck`

---

## 5. Not allowed

- Inga ändringar i `src/lib/db/schema.ts` eller migrationer
- Inga ändringar i API-kontrakten (request/response-format)
- Inga ändringar i UI-layout, text eller stilar
- Inga nya npm-paket
- Inga filnivå `/* eslint-disable */`-kommentarer
- Rör inte `.env*`-filer

---

## 6. Acceptance criteria

- [ ] `npm run build` avslutas med exit code 0 och noll fel
- [ ] `npm run lint` avslutas med exit code 0 och noll fel
- [ ] `npm run typecheck` avslutas med exit code 0 och noll fel (inklusive efter `rm -rf .next`)
- [ ] Inga deprecation-varningar i build-outputen
- [ ] Inga `enterprise: 'missing'`-loggar vid build
- [ ] PR-beskrivningen dokumenterar varje observation och hur den hanterades (åtgärdad / bekräftad som icke-blockande / uppskjuten med motivering)
- [ ] Bifoga fullständig terminalutskrift från `npm run build`, `npm run lint` och `npm run typecheck` som artifact i PR:en

---

## 7. Manual test steps

1. Kör `rm -rf .next` (PowerShell: `Remove-Item -Recurse -Force .next`)
2. Kör `npm run build` — ska ge 0 fel och inga varningar
3. Kör `npm run lint` — ska ge 0 fel
4. Kör `npm run typecheck` — ska ge 0 fel
5. Kör `npm run dev` och verifiera att `/app/inbox` och `/admin` laddar korrekt
6. Bifoga samtliga terminalutskrifter som artifact

---

## 8. Security / multi-tenant review focus

- **Observation 1 (middleware/proxy):** Auth-middleware skyddar `/app(.*)` och `/api/app(.*)`. Om filnamnet ändras felaktigt kan skyddet försvinna helt — verifiera att Clerk-middleware fortfarande är aktiv efter namnbytet genom att försöka nå `/app` utan inloggning.
- **Observation 2 (enterprise price ID):** Kontrollera att borttagning av `enterprise`-nyckeln ur `PRICE_IDS` inte öppnar för att en klient kan skicka `plan: "enterprise"` och råka matchas mot ett tomt pris-ID i checkout-routen.
