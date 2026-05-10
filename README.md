# Mailmind AI Email Support

Mailmind is a premium AI-assisted customer email support platform designed for European B2B teams. It connects to existing inboxes (Outlook, Gmail, IMAP) to draft replies, summarize threads, and organize customer emails with human-in-the-loop control.

## 🚀 Project Overview
The platform consists of:
- **Marketing Landing Page**: High-performance, SEO-optimized page built for conversion.
- **Customer Portal**: A data-focused dashboard for managing subscriptions, team members, and usage tracking.
- **Admin Dashboard**: Internal CMS for managing the Knowledge Base, tracking customer pilots, and auditing system actions.

## 🛠 Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS with Glassmorphism aesthetics
- **Animations**: Framer Motion
- **Authentication**: Clerk (Multi-tenant ready)
- **Payments**: Stripe (Database-first subscription sync)
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

## 🗄 Database Management
- Use `npm run db:push` to sync your schema with the database (Neon).
- Use `npm run db:studio` for a local database UI.
- The schema is located in `src/lib/db/schema.ts`.

## 📜 Useful Scripts
- `npm run dev`: Starts the development server.
- `npm run lint`: Runs ESLint for code quality checks.
- `npm run typecheck`: Runs TypeScript compiler check.
- `npm run build`: Generates the production build.
- `npm run db:push`: Syncs Drizzle schema to Neon.
- `npm run db:studio`: Opens the database visualizer.

## 🛡 Code Quality & Safety
The codebase is hardened for production:
- **100% Type Safe**: Strictly typed across all components, API routes, and database queries.
- **Linted**: Zero ESLint errors in the `src/` directory.
- **Admin Security**: Protected routes with identity-based audit logging.

## 🚀 Deployment Notes
For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md). The project is optimized for deployment on Vercel.

## ✅ Production Checklist
- [x] Verify Clerk production keys are set.
- [x] Verify Stripe live price IDs and webhook secret are set.
- [x] Ensure the domain is verified in Resend.
- [x] Run `npm run build` locally to verify there are no errors.
- [x] Add Favicon and optimize Meta tags for SEO.

## ⚠️ Known Limitations
- **Legal Pages**: All legal documents currently use placeholders and must be reviewed before launch.
- **Mock Data**: The platform uses mock data (`src/lib/db/mock.ts`) when `DATABASE_URL` is missing. Ensure the database is connected in production.
