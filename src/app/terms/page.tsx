import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <main className="min-h-screen pt-24 pb-16">
      <Section className="max-w-4xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: May 5, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing or using {siteConfig.siteName}, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Use of Service</h2>
            <p>
              {siteConfig.siteName} provides AI-assisted email support tools. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. You agree to use the service only for lawful purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. AI Content Disclaimer</h2>
            <p>
              The AI-generated drafts and summaries are provided as suggestions. Users are responsible for reviewing and approving all outgoing communications. {siteConfig.siteName} is not liable for any errors or omissions in content generated or modified by AI.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Subscriptions and Payments</h2>
            <p>
              Billing is handled via Stripe. Fees are non-refundable unless required by law. You may cancel your subscription at any time through the customer portal.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, {siteConfig.siteName} shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
            </p>
          </section>
        </div>
      </Section>
    </main>
  );
}
