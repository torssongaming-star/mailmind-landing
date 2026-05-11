"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  CreditCard, 
  BarChart2, 
  Users, 
  Settings, 
  Mail, 
  UserCircle, 
  HelpCircle,
  ArrowLeft 
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { siteConfig } from "@/config/site";

interface DashboardHeaderProps {
  title: string;
  description?: string;
}

const navItems = [
  { href: "/app",                label: "Home",      icon: LayoutDashboard },
  { href: "/app/inbox",          label: "Inbox",     icon: Mail },
  { href: "/dashboard/billing",  label: "Billing",   icon: CreditCard },
  { href: "/app/settings/account", label: "Account", icon: UserCircle },
  { href: "/app/settings",       label: "Settings",  icon: Settings },
  { href: "/dashboard/team",     label: "Team",      icon: Users },
  { href: "/dashboard/usage",    label: "Usage",     icon: BarChart2 },
  { href: "mailto:support@mailmind.se", label: "Support", icon: HelpCircle },
];

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const { user } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Prevent background scroll while menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#030614]/60 backdrop-blur-sm shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -ml-2 text-muted-foreground hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
            {description && (
               <p className="text-xs text-muted-foreground hidden sm:block">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-muted-foreground hidden md:block">
              {user.primaryEmailAddress?.emailAddress}
            </span>
          )}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8 ring-1 ring-primary/30 hover:ring-primary/60 transition-all",
                userButtonPopoverCard: "bg-[#050B1C] border border-white/10 backdrop-blur-xl",
                userButtonPopoverActionButton: "hover:bg-white/5 text-white",
                userButtonPopoverActionButtonText: "text-white",
                userButtonPopoverFooter: "border-t border-white/10",
              },
            }}
          />
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-[100dvh] w-[85vw] max-w-[280px] bg-[#030614]/95 backdrop-blur-xl border-r border-white/10 z-50 lg:hidden flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
                <Link href="/" className="flex items-center gap-2.5 group">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                    <Mail size={15} />
                  </div>
                  <span className="font-bold text-lg tracking-tight text-white">{siteConfig.siteName}</span>
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="ml-auto p-2 text-muted-foreground hover:text-white rounded-xl active:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              
              <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 overscroll-contain">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href ||
                    (href !== "/app" && href !== "/dashboard" &&
                     pathname.startsWith(href + "/"));
                     
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]"
                          : "text-muted-foreground hover:text-white hover:bg-white/[0.04] active:bg-white/5"
                      )}
                    >
                      <Icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              {/* Back to site */}
              <div className="p-4 border-t border-white/5 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0">
                <Link
                  href="/"
                  className="flex items-center gap-2.5 px-3 py-3 text-sm text-muted-foreground hover:text-white transition-colors rounded-xl hover:bg-white/[0.04] active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <ArrowLeft size={16} />
                  Back to {siteConfig.domain}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

