# Antigravity tasks — Mailmind

> **Skapad 2026-05-12.** Varje task är fristående och shippas som **en PR**.
>
> **Innan du börjar:** läs i denna ordning
> 1. `CLAUDE.md` — låsta beslut, arbetssätt
> 2. `.claude/context/project-state.md` — vad som är byggt, kvarvarande caveats
> 3. `package.json` (innan du föreslår nytt paket — motivera i commit)
>
> **Spelregler:**
> - Multi-tenant first — varje query utan `organizationId` i WHERE är en läcka, avvisas i review.
> - Kodbasen vinner över dokument om de skiljer sig. Flagga drift i PR-beskrivningen.
> - Schemaändringar: uppdatera `src/lib/db/schema.ts` och säg till Sebastian att köra `npm run db:push`. Enum-tillägg kräver rå SQL i Neon (`ALTER TYPE ... ADD VALUE`).
> - `"use server"`-filer: bara `export async function`, inga exporterade konstanter.
> - Inga README/*.md-tillägg om inte specifikt ombett.
> - Commit-meddelanden på engelska, conventional commits-stil.
>
> **Pendelfilen är `npm run db:push` för task #3.** Säg till Sebastian när du är där.

---

## 1. Team management — bjud in kollegor

**Prio:** P1
**Värde:** Idag är `/dashboard/team` en "coming soon"-platshållare. Pilotkunder vill bjuda in en kollega innan de drar igång.

**Files att läsa först:**
- `src/app/(portal)/dashboard/team/page.tsx` (platshållaren)
- `src/lib/db/schema.ts` — `users`-tabellen, `organizationId`-kopplingen
- `src/lib/app/entitlements.ts` — `account.access.canInviteUser`, `account.entitlements.maxUsers`
- Clerk Organizations: https://clerk.com/docs/organizations/overview

**Att bygga:**
1. Lista nuvarande medlemmar (rader från `users WHERE organizationId = ?`)
2. "Bjud in"-formulär: e-post + roll. Använd Clerk's `organization.inviteMember()` på server-side (skapa `/api/app/team/invite`-route)
3. Visa pending invitations från Clerk (`organization.getInvitations()`)
4. Respektera `maxUsers`-gränsen från entitlements — visa "Uppgradera plan"-banner när full
5. "Ta bort medlem"-knapp (bara om current user är admin)

**Done när:**
- Pilotkunder kan bjuda in en kollega via UI och kollegan kan logga in
- Inbjudningar dyker upp i listan tills accepterade
- Trycker man "Bjud in" som full plan får man tydlig fel-feedback med länk till `/dashboard/billing`

---

## 2. AI-retry med backoff vid transienta fel

**Prio:** P1
**Värde:** `client.messages.create()` i `src/lib/app/ai.ts` failar closed vid 5xx/timeouts → kunden får "no draft" på flödet. Anthropic har enstaka glitches; en retry räcker oftast.

**Files att läsa först:**
- `src/lib/app/ai.ts` — det finns redan en `retryWithBackoff`-helper, kolla att den är wraparound på allt
- `src/lib/app/autoTriage.ts` — main consumer-väg
- `src/app/api/app/ai/draft/route.ts` — manuell väg

**Att bygga:**
1. Verifiera vilka AI-anrop som *inte* är wrappade i `retryWithBackoff`
2. Wrappa dem. Retry-policy: 2 retries, 500ms + 1500ms backoff, bara på 5xx/timeout/network — INTE på 4xx (4xx betyder vi skickade dålig input, ingen point att retrya)
3. Vid slutgiltig miss: returnera tydlig `{ ok: false, reason: "ai_transient_error" }` så autoTriage kan logga och fortsätta utan att kasta

**Done när:**
- Audit log visar "ai_draft_generated" även efter simulerad transient miss
- Manuell test: blockera api.anthropic.com via firewall → /api/app/ai/draft returnerar 200 med `triage: "skipped: ai_transient_error"`, INTE 500

---

## 3. Snooze-presets på tråd-sidan

**Prio:** P2
**Värde:** Just nu kräver snooze att man väljer datumtid manuellt. Två klick för "imorgon morgon" är överarbete för en supportagent.

**Files att läsa först:**
- `src/app/(portal)/app/thread/[id]/SnoozeButton.tsx` — befintlig komponent
- `src/app/api/app/threads/[id]/snooze/route.ts` — endpoint är klar, accepterar bara ISO-timestamp

**Att bygga:**
1. Lägg till en dropdown bredvid "Snooze"-knappen med presets:
   - 1 timme
   - 3 timmar
   - Imorgon kl 08:00 (lokal tid Europe/Stockholm)
   - Nästa måndag kl 08:00
   - Anpassat… (öppnar nuvarande datetime-picker)
2. När preset väljs: räkna ut absolute ISO-string client-side, posta till endpointen
3. Stäng dropdown automatiskt vid val

**Done när:**
- En agent kan snooza "till imorgon morgon" i 2 klick utan att skriva ett datum
- Vid uppvaknande: cron `*/15 * * * *` plockar upp den (redan implementerat, ingen ändring där)

---

## 4. Stats: tidsperiod-toggle

**Prio:** P2
**Värde:** `/app/stats` visar hårdkodat 14 dagar i bar chart. Vissa kunder kommer vilja kolla månad.

**Files att läsa först:**
- `src/app/(portal)/app/stats/page.tsx`
- `src/app/(portal)/app/stats/DailyThreadsChart.tsx`
- `src/lib/app/stats.ts` — `getThreadsPerDay(orgId, days)` accepterar redan ett `days`-argument

**Att bygga:**
1. Lägg `?range=7d|14d|30d|90d` på `/app/stats`. Server-component läser, default 14d
2. Toggle-rad ovanför chart: 4 pillar med aktiv markering
3. När man trycker → `router.push("/app/stats?range=30d")`
4. För 30d/90d: byt bar chart till en area chart eller LineChart (recharts) — för läsbarhet

**Done när:**
- Alla 4 ranges renderar utan layout-skift
- Refresh på `?range=30d` behåller valet

---

## 5. Webhook delivery log — retention-cron

**Prio:** P2
**Värde:** `webhook_deliveries` växer obegränsat. På en kund med 100 mejl/dag och 3 webhooks blir det ~110 000 rader/år.

**Files att läsa först:**
- `src/lib/app/webhooks.ts` — där `fireWebhooksForThread` skriver till tabellen
- `src/app/api/cron/usage-warning/route.ts` — referensmönster för Vercel Cron
- `vercel.json` — cron-config

**Att bygga:**
1. Ny route `/api/cron/webhook-cleanup/route.ts` skyddad av `CRON_SECRET`, gör `DELETE FROM webhook_deliveries WHERE sent_at < now() - interval '30 days'`
2. Lägg in i `vercel.json`: `"schedule": "0 3 * * *"` (03:00 UTC dagligen)
3. Returnera `{ ok: true, deleted: N }` så man kan kolla i Vercel cron-loggen

**Done när:**
- Cron kör dagligen, deletar 30+ dagar gamla rader
- Inga 100k+ rader i tabellen efter en månads drift

---

## 6. Mobil-sidebar — visuell QA

**Prio:** P2
**Värde:** Sidebaren har en mobil-drawer implementerad ([src/components/portal/Sidebar.tsx](../src/components/portal/Sidebar.tsx)), men ingen har testat den i en riktig browser.

**Vad du gör:**
1. `npm run dev`
2. Öppna `/app` i Chrome DevTools mobile mode: iPhone 14, iPad Mini, och Galaxy S20
3. Verifiera:
   - Hamburger-knappen syns och fungerar
   - Drawern slidar in mjukt från vänster
   - Backdrop dimmer, klick på backdrop stänger
   - Route-byte stänger drawern automatiskt
   - Stängningsknappen (X) fungerar
   - Body-scroll låses när drawer är öppen
4. Hitta defekter, fixa dem i samma PR

**Done när:**
- Skärmdumpar bifogas PR:n från alla tre viewport-storlekar
- Inga regressioner på desktop (≥1024px)

---

## 7. Trial-banner: "uppgradera nu"-knapp förfinad

**Prio:** P3
**Värde:** Trial-bannern i `/app/page.tsx` blir röd på dag ≤3. Den länkar till `/dashboard/billing` men säger inte vilken plan vi rekommenderar.

**Files att läsa först:**
- `src/app/(portal)/app/page.tsx` — `TrialBanner`-komponent
- `src/lib/plans.ts` — PLANS-konstanten

**Att bygga:**
1. När `daysLeft <= 3`: hämta org's nuvarande plan + visa "Behåll [planName] för X kr/mån"-CTA direkt i bannern
2. Knappen → `/dashboard/billing?upgrade=<planKey>` (befintlig route)
3. Mjuk hover-animation på CTA:n

**Done när:**
- Kund med 2 dagar kvar ser planpris och knapp direkt utan att klicka in i billing

---

## Längre fram (lägg INTE igång nu — väntar på Sebastian)

- **Resend Inbound-migration** — koden är förbered (`src/app/api/webhooks/resend/inbound/route.ts` ligger dormant), men kräver Resend Pro ($20/mån) för att lägga till `mail.mailmind.se` som separat domän. Vi kör SendGrid Inbound Parse tills första betalande kund motiverar uppgradering.
- **Multi-tenant kunddomäner** — pilot-kunder vill ha `support@<deras-domän>.se` istället för `<slug>@mail.mailmind.se`. Plan finns i `~/.claude/projects/.../plan_customer_domains.md` enligt Sebastian.
- **Test-suite seed** — finns inget än. Diskutera scope med Sebastian innan du introducerar Vitest/Jest.

---

## Kontakt

Frågor → Sebastian (kodaren). Block? Skriv i PR-beskrivningen vad du fastnade på och tagga honom.
