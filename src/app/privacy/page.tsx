import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: May 5, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              At {siteConfig.siteName}, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website {siteConfig.domain} and use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us, such as when you request a demo, create an account, or contact our support team. This may include your name, work email address, company name, and technical details about your email environment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Data Processing</h2>
            <p>
              Our platform processes email metadata and content to provide AI-assisted drafting and summarization. We strive to handle all data with high standards of security and confidentiality. While we aim for transparency and safety, we encourage users to review their internal data handling policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Services</h2>
            <p>
              We use third-party providers for authentication (Clerk), payments (Stripe), and email delivery (Resend). These services have their own privacy policies and data handling practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at {siteConfig.supportEmail}.
            </p>
          </section>
        </div>
      </Section>
    </main>
  );
}
