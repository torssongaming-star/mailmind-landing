"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Users,
  BarChart2,
  Mail,
  ArrowLeft,
  AppWindow,
  UserCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { siteConfig } from "@/config/site";

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 hidden lg:flex flex-col border-r border-white/5 bg-[#030614]/95 backdrop-blur-md">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_12px_rgba(6,182,212,0.2)] group-hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] transition-shadow">
            <Mail size={15} />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">{siteConfig.siteName}</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/app" || href === "/dashboard"
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]"
                  : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <Icon size={17} className={isActive ? "text-primary" : "text-muted-foreground"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Back to site */}
      <div className="p-4 border-t border-white/5">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-muted-foreground hover:text-white transition-colors rounded-xl hover:bg-white/[0.04]"
        >
          <ArrowLeft size={14} />
          Back to {siteConfig.domain}
        </Link>
      </div>
    </aside>
  );
}
