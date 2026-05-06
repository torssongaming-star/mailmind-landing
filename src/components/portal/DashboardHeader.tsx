"use client";

import { UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Menu, X, AppWindow, LayoutDashboard, CreditCard, BarChart2, Users, Settings, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardHeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const { user } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/app",                label: "App",       icon: AppWindow },
    { href: "/dashboard/overview", label: "Overview",  icon: LayoutDashboard },
    { href: "/dashboard/billing",  label: "Billing",   icon: CreditCard },
    { href: "/dashboard/usage",    label: "Usage",     icon: BarChart2 },
    { href: "/dashboard/team",     label: "Team",      icon: Users },
    { href: "/dashboard/settings", label: "Settings",  icon: Settings },
  ];

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#030614]/60 backdrop-blur-sm shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -ml-2 text-muted-foreground hover:text-white lg:hidden"
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
                avatarBox: "w-8 h-8 ring-1 ring-primary/30",
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
              className="fixed inset-y-0 left-0 w-72 bg-[#030614] border-r border-white/10 z-50 lg:hidden flex flex-col"
            >
              <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
                <Link href="/" className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                    <Mail size={15} />
                  </div>
                  <span className="font-bold text-lg text-white">Mailmind</span>
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="ml-auto p-2 text-muted-foreground hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                      )}
                    >
                      <Icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
