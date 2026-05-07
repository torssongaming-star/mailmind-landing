# Mailmind Outlook Add-in MVP

The Mailmind Outlook Add-in provides a taskpane interface directly within Microsoft Outlook, allowing users to view their Mailmind account status and access their inbox without leaving their email client.

## Features (MVP)
- **Account Overview**: Displays organization name and current subscription plan.
- **Usage Tracking**: Live progress bar showing AI draft usage for the current billing cycle.
- **Access Management**: Instant alerts if account access is restricted (e.g., due to billing issues).
- **Deep Linking**: Quick access to the Mailmind inbox with source tracking (`?source=outlook`).
- **Secure Authentication**: Integration with Clerk via the Office Dialog API for reliable cross-platform login.

## Intentionally Postponed
- **Email Content Reading**: The add-in does not read email subject or body content yet.
- **AI Drafting in Outlook**: Generating drafts directly into the Outlook compose window is planned for Phase 2.
- **Microsoft Graph Integration**: No direct access to Microsoft account data or tokens.
- **Gmail Support**: Currently restricted to Outlook (Office 365, Outlook.com, and Desktop).

## Permissions
- **ReadItem**: This is the minimum permission required to activate the taskpane when an email is selected. It does not allow the add-in to modify your mailbox or send emails.

## Local Development & Testing

### HTTPS Requirement
Outlook Add-ins **must** be served over HTTPS. You can use one of the following methods:
1. **Next.js Experimental HTTPS**:
   ```bash
   npm run dev -- --experimental-https
   ```
2. **Tunneling (ngrok)**:
   ```bash
   ngrok http 3000
   ```

### Sideloading in Outlook Web
1. Open [Outlook Web](https://outlook.office.com).
2. Open any email message.
3. Click the **"..." (More actions)** menu in the email header.
4. Select **Get Add-ins**.
5. Go to **My Add-ins** > **Add a custom add-in** > **Add from file...**.
6. Upload the `public/addins/outlook/manifest.xml` file.
7. Click **Install**.

*Note: For local testing, you must update the URLs in `manifest.xml` from `mailmind.se` to your local HTTPS address.*

## Production Requirements
- **Valid SSL**: The production domain (`mailmind.se`) must have a valid SSL certificate.
- **AppSource Validation**: The manifest must contain valid Privacy Policy and Terms of Use links (configured in the final submission).
