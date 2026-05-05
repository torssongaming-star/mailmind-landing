import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, Zap } from "lucide-react";

export default function SecurityPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Security & Compliance</h1>
        <p className="text-muted-foreground mb-12">How we protect your data at {siteConfig.siteName}.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <Lock className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Encryption</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              All data is encrypted in transit using TLS 1.3 and at rest using industry-standard AES-256 encryption.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Access Control</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              We use Clerk for enterprise-grade authentication with support for Multi-Factor Authentication (MFA).
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <Eye className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Privacy First</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              We do not train our foundational models on your individual customer email content. Your data remains yours.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <Zap className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Human-in-the-loop</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Our AI suggestions require explicit human approval before being sent. You maintain full control.
            </p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data Residency</h2>
            <p>
              We prioritize data residency within the European Economic Area (EEA) where possible. Our infrastructure providers are selected based on their commitment to high security standards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Responsible Disclosure</h2>
            <p>
              If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly. Please email {siteConfig.securityEmail || siteConfig.supportEmail} with your findings.
            </p>
          </section>
        </div>
      </Section>
    </main>
  );
}
