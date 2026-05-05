# Deployment Guide — Mailmind

This guide outlines the steps required to deploy the Mailmind landing page and customer portal to production.

## 1. Vercel Setup
- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Environment Variables**: Import variables from your production environment (see section below).

## 2. Clerk Setup (Authentication)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com).
2. Create a new production application (or use your existing one).
3. Update the **Allowed Redirect URLs** to include your production domain:
   - `https://mailmind.se/login`
   - `https://mailmind.se/signup`
   - `https://mailmind.se/dashboard`
4. Copy the **Publishable Key** and **Secret Key** to Vercel environment variables.

## 3. Stripe Setup (Billing)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com).
2. Create your products (Starter, Team, Business) and copy their **Price IDs**.
3. Set up a **Webhooks** endpoint in Stripe:
   - **URL**: `https://mailmind.se/api/webhooks/stripe`
   - **Events**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copy the **Webhook Secret** (starts with `whsec_`) to Vercel.

## 4. Resend Setup (Email)
1. Go to [Resend Dashboard](https://resend.com).
2. Verify the domain `mailmind.se`.
3. Create an **API Key** and add it to Vercel.
4. Ensure `DEMO_REQUEST_FROM` uses your verified domain (e.g., `onboarding@mailmind.se`).

## 5. Neon Setup (Database)
1. Go to [Neon Console](https://console.neon.tech).
2. Create a new project/database.
3. Copy the **Connection String** (`DATABASE_URL`) and add it to Vercel.

## Required Environment Variables

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client-side key |
| `CLERK_SECRET_KEY` | Clerk server-side secret |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/signup` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |
| `STRIPE_SECRET_KEY` | Stripe server-side secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | `https://mailmind.se` |
| `DATABASE_URL` | Neon Postgres connection string |
| `RESEND_API_KEY` | Resend API key |
| `DEMO_REQUEST_TO` | Email address to receive demo requests |
| `DEMO_REQUEST_FROM` | Verified sender email (e.g. hello@mailmind.se) |

## Post-Deploy Test Checklist
- [ ] **Auth**: Login and Signup flows work on the production domain.
- [ ] **Dashboard**: Protected routes redirect correctly to login if not authenticated.
- [ ] **Billing**: "Subscribe" button opens Stripe Checkout with the correct price.
- [ ] **Webhooks**: Test a mock checkout and verify the user's plan updates in the dashboard (requires DB).
- [ ] **Contact Form**: Submit a demo request and verify the email is received.
- [ ] **SEO**: Check `https://mailmind.se/sitemap.xml` and `robots.txt`.
- [ ] **Analytics**: Verify Vercel Analytics data is appearing in the Vercel dashboard.
