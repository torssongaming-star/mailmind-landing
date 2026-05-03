import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#01030B] relative pt-20 pb-10 border-t border-white/5 overflow-hidden">
      {/* Subtle top border glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-primary/5 blur-[50px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6 inline-block">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                <span className="text-white font-bold text-lg leading-none">M</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-white">Mailmind</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8">
              AI-assisted customer email support for European businesses.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-white mb-6 tracking-wide">Product</h4>
            <ul className="space-y-4">
              <li><Link href="#features" className="text-muted-foreground hover:text-primary transition-colors text-sm">Features</Link></li>
              <li><Link href="#pricing" className="text-muted-foreground hover:text-primary transition-colors text-sm">Pricing</Link></li>
              <li><Link href="#security" className="text-muted-foreground hover:text-primary transition-colors text-sm">Security</Link></li>
              <li><Link href="#faq" className="text-muted-foreground hover:text-primary transition-colors text-sm">FAQ</Link></li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold text-white mb-6 tracking-wide">Company</h4>
            <ul className="space-y-4">
              <li><Link href="#contact" className="text-muted-foreground hover:text-primary transition-colors text-sm">Contact</Link></li>
            </ul>
          </div>
        </div>

        {/* Legal Note */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 Mailmind. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
