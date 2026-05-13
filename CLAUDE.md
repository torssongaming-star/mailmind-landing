# Mailmind — instruktioner för Claude Code

Du arbetar i Mailmind-projektet.

## Läs alltid först

1. `.claude/context/project-state.md`
2. `package.json`
3. `docs/roadmap/mailmind-sverige-mvp.md` om den finns
4. Relevanta filer innan du föreslår task eller kod

## Låsta beslut

- Första marknad: Sverige
- Go-to-market: demo-led SaaS med assisterad onboarding för varje ny kund
- Segment: generell SMB
- Integration: Microsoft 365/Outlook först
- Autosvar: får skickas automatiskt **endast** när confidence >= 90 %, svaret är källgrundat, risknivån är låg och inga blockeringsskäl finns
- Dry-run ska användas innan autosvar aktiveras

## Arbetssätt

- Ge inga breda implementationer.
- Skapa små, reviewbara tasks åt Antigravity.
- Inga nya paket utan att först kontrollera `package.json` och motivera varför.
- Alla DB reads/writes ska vara `organizationId`-scopade.
- Inga secrets i client code eller logs.
- Kodbasen vinner över dokument om de skiljer sig.
