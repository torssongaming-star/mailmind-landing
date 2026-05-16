# Mailmind — Manual QA Checklist

Use this before every production deploy. Estimated time: ~15 minutes for the
core path, ~30 minutes for the full checklist.

**Test environment**: Vercel preview deployment or local `npm run dev` with a
fresh test account.

---

## 🚦 Smoke test (5 min — must pass)

### Auth & onboarding
- [ ] Sign up with a new email → email verification flow works
- [ ] After verification: lands on `/app/onboarding`
- [ ] Onboarding step 1: enter company name → "Fortsätt" → no error
- [ ] Onboarding step 2 (website): can skip OR enter a real URL — scrape succeeds within 30s
- [ ] Onboarding step 3 (case types): default 4 checked + "Lägg till egen" works
- [ ] Onboarding step 4 (AI behavior): tone + language saved
- [ ] Onboarding step 5 (webhooks): can skip
- [ ] After onboarding: lands on `/app` dashboard

### Inbox connection
- [ ] `/app/inboxes` shows 3-card chooser (Outlook recommended, Gmail, Forwarding)
- [ ] "Vidarebefordra" → form opens, slug + display name → "Skapa" works
- [ ] Created inbox shows `slug@mail.mailmind.se` with copy button
- [ ] ConnectionTester polls for 60s, dismissible
- [ ] Disconnect button → ConfirmDialog → "Koppla bort" actually removes inbox

### Inbox triage
- [ ] `/app/inbox` shows empty state with icon when no threads
- [ ] Click "Ny testtråd" → modal opens, ESC closes it
- [ ] Drag inside input from inside to outside → modal does NOT close
- [ ] Submit testtråd with default values → thread appears, list refreshes
- [ ] Click thread in list → ThreadPanel shows on right (desktop)
- [ ] On mobile (<768px): clicking thread switches to full-screen panel with back-arrow
- [ ] Click "Generera AI-utkast" → Sparkles icon spinner → draft appears within 5s
- [ ] Draft card has cyan glow, status chip, body text
- [ ] Click "Redigera" → textarea opens with content
- [ ] Click "Spara" → returns to view mode
- [ ] Click "Spara och skicka" → both edit + send, no race condition (no flash of inconsistent state)

### Team
- [ ] `/app/team` shows owner with crown badge
- [ ] "Bjud in" panel opens inline (not modal)
- [ ] Enter email + select role + send → invite appears in pending list
- [ ] Resend: open invite email → click "Acceptera" link → lands on `/app` with success
- [ ] Cancel invite → dialog → removes pending invite
- [ ] Remove member → ConfirmDialog shows org name + email → removes
- [ ] Change role dropdown (owner only) → updates without page reload

### Settings
- [ ] All 6 tabs render content (General, Case Types, Knowledge, Templates, Blocklist, Webhooks)
- [ ] Active tab has left-edge cyan accent
- [ ] `?tab=team` redirects to `/app/team` (not in tabs anymore)
- [ ] `/app/settings/account` shows: Language, Push notifications, Data privacy, Clerk profile

### Billing
- [ ] `/dashboard/billing` shows current plan with status badge
- [ ] Plan cards: active has glow, inactive have hover effect
- [ ] "Välj plan" → Stripe checkout opens (test mode)
- [ ] Stripe portal button opens portal (test mode)
- [ ] Cancellation → back to `/dashboard/billing?checkout=cancelled` shows amber banner

---

## ⌨️ Keyboard & A11y (5 min)

- [ ] **⌘K / Ctrl+K** anywhere → Command palette opens
- [ ] Type "inbox" → "Inkorg" matches via fuzzy
- [ ] ↑↓ moves selection
- [ ] Enter activates
- [ ] ESC closes palette
- [ ] Type query 2+ chars → debounced thread search appears below static items
- [ ] **Tab** through any page → focus ring visible on every interactive element
- [ ] **Enter/Space** on a thread row → opens that thread (keyboard nav)
- [ ] **ESC** closes any modal (NewThread, ConfirmDialog, Command palette)
- [ ] Screen reader: `aria-current="page"` on active sidebar link
- [ ] `aria-modal="true"` on all dialogs

---

## 📱 Mobile (5 min — Chrome DevTools or real device, 375×667)

- [ ] Sidebar collapses to hamburger menu
- [ ] Tap hamburger → drawer slides in, body scroll locked
- [ ] Inbox: only list visible, no split-pane
- [ ] Tap thread → panel full-screen with back-arrow
- [ ] Back-arrow → returns to list
- [ ] AppBanners on `/app` don't overflow
- [ ] Stat cards stack 1 col / 2 col gracefully
- [ ] Team page: invite panel form stacks vertically
- [ ] No horizontal scroll anywhere

---

## 💳 Billing & limits (3 min)

- [ ] When trial < 3 days: amber banner with "Lägg till kort"
- [ ] When trial > 7 days: primary banner with countdown
- [ ] Trigger AI generation past `maxAiDraftsPerMonth` limit → red banner + 429 from API
- [ ] Add inbox past `maxInboxes` → amber warning, button hidden

---

## 🔐 Security smoke (3 min)

- [ ] Hit `/api/cron/tick` without Authorization → 401
- [ ] Hit `/api/webhooks/microsoft/notifications` with wrong clientState → silently ignored (no 5xx)
- [ ] Hit `/api/webhooks/stripe` without signature → 400 (NOT 200)
- [ ] `/api/app/team/accept?token=X&redirect_url=https://evil.com` → bounces to `/app?invite_error=invalid_redirect`
- [ ] Org A user cannot fetch Org B's thread (404)

---

## 📧 Email delivery (5 min — requires real email account)

- [ ] Invite email arrives in inbox (not spam) with proper From/SPF/DKIM
- [ ] Weekly report mock test (`/api/cron/tick` manually with correct auth on a Monday)
- [ ] Notification email after new thread
- [ ] Subscription renewal failure alert (manually mark `renewalFailCount = 2` on a test inbox)

---

## 🛡️ GDPR (2 min)

- [ ] `/app/settings/account` shows "Exportera alla data" — clicking downloads JSON
- [ ] Owner can request account deletion → typing org name confirms
- [ ] Pending deletion → sidebar shows red countdown badge
- [ ] Pending deletion → AppBanners shows red countdown
- [ ] Pending deletion → user can still log in but AI/inbox/invite blocked
- [ ] "Ångra radering" works → clears `deletionRequestedAt`

---

## 🎨 Visual polish (2 min — quick eye-pass)

- [ ] Status dots on "open" threads pulse softly
- [ ] AI-draft cards have subtle cyan glow
- [ ] Sidebar active item has left-edge accent bar
- [ ] Hover on cards: border lightens, no jarring jumps
- [ ] Toasts appear bottom-right with glow shadow per type
- [ ] Loading states use skeleton, not raw spinner

---

## 📝 Notes

- If any item fails: add it to the bug list + fix before deploy.
- For new features added: add a new section here.
- Re-run after every major UX change.
