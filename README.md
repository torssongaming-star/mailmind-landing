# Mailmind AI Email Support

Mailmind is a premium AI-assisted customer email support platform designed for European B2B teams. It connects to existing inboxes (Outlook, Gmail, IMAP) to draft replies, summarize threads, and organize customer emails with human-in-the-loop control.

## 🚀 Project Overview
The platform consists of a high-performance marketing landing page and a data-focused customer portal for managing subscriptions, team members, and usage tracking.

## 🛠 Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Authentication**: Clerk
- **Payments**: Stripe
- **Email Delivery**: Resend
- **Database**: Neon Postgres
- **ORM**: Drizzle ORM
- **Deployment**: Vercel

## 💻 Local Development Setup
1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in the required keys.
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

## 🔑 Required Environment Variables
Refer to [.env.example](.env.example) for a complete list of required variables. Key services include:
- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`
- **Resend**: `RESEND_API_KEY`, `DEMO_REQUEST_FROM`, `DEMO_REQUEST_TO`
- **Database**: `DATABASE_URL`

## 🔐 Clerk Setup
- Configure your application at [Clerk Dashboard](https://dashboard.clerk.com).
- Set redirect URLs in `.env.local` as specified in the example.
- Ensure the production domain is added to Clerk's Allowed Redirect URLs.

## 💳 Stripe Setup
- Enable Stripe webhooks pointing to `/api/webhooks/stripe`.
- Listen for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` events.
- For local testing, use the Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```

## 📧 Resend Setup
- Verify your domain (e.g., `mailmind.se`) in the Resend dashboard.
- Update `DEMO_REQUEST_FROM` to use a verified address from your domain.

## 🗄 Neon/Drizzle Setup
- Create a project in [Neon Console](https://console.neon.tech).
- Use `npm run db:push` to sync your schema with the database.
- Use `npm run db:studio` for a local database UI.

## 📜 Useful Scripts
- `npm run dev`: Starts the development server.
- `npm run lint`: Runs ESLint for code quality checks.
- `npm run typecheck`: Runs TypeScript compiler check.
- `npm run build`: Generates the production build.
- `npm run db:push`: Syncs Drizzle schema to Neon.
- `npm run db:studio`: Opens the database visualizer.

## 🚀 Deployment Notes
For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md). The project is optimized for deployment on Vercel.

## ✅ Production Checklist
- [ ] Verify Clerk production keys are set.
- [ ] Verify Stripe live price IDs and webhook secret are set.
- [ ] Ensure the domain is verified in Resend.
- [ ] Run `npm run build` locally to verify there are no errors.
- [ ] Check `sitemap.xml` and `robots.txt` for correct URLs.

## ⚠️ Known Limitations
- **Legal Pages**: All legal documents (Privacy Policy, Terms of Service, etc.) currently use placeholders and must be reviewed by legal counsel before launch.
- **Billing Sync**: Subscription sync logic should be thoroughly tested in Stripe Test Mode before processing real payments.
- **Mock Data**: The platform uses mock data (`src/lib/db/mock.ts`) when `DATABASE_URL` is missing. Ensure the database is connected in production to avoid showing test data to users.
