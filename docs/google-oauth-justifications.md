# Google OAuth scope justifications

> Paste these texts verbatim into the Google Cloud Console verification form.
> Google reviewers verify in English — do not translate to Swedish.
>
> If a reviewer asks follow-up questions, answer in English and keep the same
> tone (factual, references your actual product behaviour, no marketing copy).

---

## Sensitive scope — `https://www.googleapis.com/auth/gmail.send`

### "How will the scopes be used?"

```
Mailmind is a customer support automation platform for small and
medium-sized businesses in the Nordics. After a user explicitly connects
their Gmail inbox via OAuth, our application uses gmail.send to dispatch
reply drafts that the user has reviewed and approved inside the Mailmind
dashboard.

The send action is always triggered by an explicit user action — either
pressing "Send" on an AI-generated draft, or by the user enabling
auto-send for high-confidence drafts that meet four locked safety rules:
confidence >= 90%, source-grounded answer, low risk level, and a
non-new sender. No emails are sent without the user's prior configuration
and approval.

We chose gmail.send rather than gmail.compose because Mailmind needs to
send the final reply, not just create a draft. Sending via the Gmail API
ensures replies originate from the user's own mailbox so customers see
continuity in the conversation thread — sending via a third-party relay
would break threading and harm the user's deliverability.
```

---

## Restricted scope — `https://www.googleapis.com/auth/gmail.modify`

### "What features will you use?"
Select: **Reply to or forward email**

### "How will the scopes be used?"

```
Mailmind uses gmail.modify exclusively to:

1. Add the message we just sent (via gmail.send) to the user's "Sent"
   folder so it appears in their normal Gmail view, and

2. Apply a Mailmind label to processed threads so the user can filter
   handled vs. unhandled mail directly in Gmail.

We do not delete, archive, or modify any message the user did not
explicitly act on through the Mailmind dashboard. We do not permanently
delete any message.

We chose gmail.modify rather than the broader gmail.full because we
never need to manage drafts, change settings, or impersonate the user
beyond writing back the replies they have approved.
```

---

## Restricted scope — `https://www.googleapis.com/auth/gmail.readonly`

### "What features will you use?"
Select: **Display email content to users**

### "How will the scopes be used?"

```
Mailmind reads incoming emails from the user's connected inbox to:

1. Display the message inside the Mailmind triage dashboard,

2. Generate an AI-suggested reply draft that the user reviews before
   any response is sent, and

3. Classify the message by case type (support, billing, sales, etc.)
   so the user can prioritise.

Reads are scoped to messages that arrive after the user connects their
inbox via OAuth — Mailmind uses Gmail Push (Pub/Sub) for real-time
notifications and the History API to fetch only new messages, never the
full mailbox archive.

Data is stored in our EU-based Postgres database (Neon, Frankfurt
region) per organisation. Each organisation can only access its own
data; we never share content with third parties beyond the AI inference
provider (Anthropic) that generates the suggested draft text.
```

---

## Demo video — required for restricted scopes

Record a 3–5 minute screen capture showing the full end-to-end flow:

1. Sign in to Mailmind with a fresh test account
2. Click "Connect Gmail" — the Google OAuth consent screen appears
3. Approve the consent — return to Mailmind
4. An inbound email arrives in the user's Gmail and appears in the
   Mailmind dashboard within seconds (Gmail Push)
5. Mailmind generates an AI-suggested reply draft
6. The user edits the draft and clicks "Send"
7. Open Gmail in another tab — show the reply is in the "Sent" folder
   and the Mailmind label is applied

**Upload to YouTube as Unlisted** (not Public, not Private). Paste the URL
into the verification form.

The video must use the same OAuth client ID you are submitting for
verification — Google reviewers verify this against the credentials.

---

## After submission

- You will receive an email confirmation within 1–3 business days
- Initial reviewer response typically arrives in 5–10 business days
- If they ask follow-up questions, respond within 7 days or the
  submission expires
- During review you can keep developing — your app stays in "Testing"
  mode with a 100-user cap
