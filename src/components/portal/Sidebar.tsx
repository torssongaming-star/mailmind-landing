"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Users,
  BarChart2,
  Mail,
  ArrowLeft,
  UserCircle,
  HelpCircle,
  Activity,
  Inbox,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportDrawer } from "./SupportDrawer";
import { siteConfig } from "@/config/site";

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavLeaf = {
  kind:  "leaf";
  href:  string;
  label: string;
  icon:  React.ElementType;
};

type NavGroup = {
  kind:     "group";
  id:       string;
  label:    string;
  icon:     React.ElementType;
  /** href of the "root" item shown as the first child */
  rootHref: string;
  children: { href: string; label: string }[];
};

type NavItem = NavLeaf | NavGroup;

const NAV: NavItem[] = [
  {
    kind:     "group",
    id:       "home",
    label:    "Home",
    icon:     LayoutDashboard,
    rootHref: "/app",
    children: [
      { href: "/app",           label: "Översikt"  },
      { href: "/app/stats",     label: "Stats"     },
      { href: "/app/activity",  label: "Aktivitet" },
    ],
  },
  {
    kind:     "group",
    id:       "inbox",
    label:    "Inbox",
    icon:     Mail,
    rootHref: "/app/inbox",
    children: [
      { href: "/app/inbox",   label: "Alla trådar" },
      { href: "/app/inboxes", label: "Anslutna inboxes" },
    ],
  },
  {
    kind:  "leaf",
    href:  "/dashboard/billing",
    label: "Billing",
    icon:  CreditCard,
  },
  {
    kind:     "group",
    id:       "settings",
    label:    "Settings",
    icon:     Settings,
    rootHref: "/app/settings",
    children: [
      { href: "/app/settings",         label: "Arbetsyta" },
      { href: "/app/settings/account", label: "Konto"     },
    ],
  },
  {
    kind:  "leaf",
    href:  "/dashboard/team",
    label: "Team",
    icon:  Users,
  },
  {
    kind:  "leaf",
    href:  "/dashboard/usage",
    label: "Usage",
    icon:  BarChart2,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the href of the single best-matching child for the current pathname.
 * "Best" = longest href that is an exact match or a prefix of pathname.
 * This prevents /app/settings from being highlighted when on /app/settings/account.
 */
function bestActiveChildHref(
  children: { href: string }[],
  pathname: string
): string | null {
  const sorted = [...children].sort((a, b) => b.href.length - a.href.length);
  for (const child of sorted) {
    if (
      pathname === child.href ||
      pathname.startsWith(child.href + "/")
    ) {
      return child.href;
    }
  }
  return null;
}

/** Returns true if the group has an active child for the given pathname */
function groupIsActive(group: NavGroup, pathname: string): boolean {
  return bestActiveChildHref(group.children, pathname) !== null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname                  = usePathname();
  const [supportOpen, setSupportOpen] = useState(false);

  // Track which groups are manually expanded. Auto-open active group on mount/nav.
  const defaultOpen = () =>
    Object.fromEntries(
      NAV.filter((n): n is NavGroup => n.kind === "group")
         .map(g => [g.id, groupIsActive(g, pathname)])
    );

  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultOpen);

  // Whenever the route changes, make sure the active group is open
  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      NAV.forEach(item => {
        if (item.kind === "group" && groupIsActive(item, pathname)) {
          next[item.id] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  const toggle = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 w-64 hidden lg:flex flex-col border-r border-white/5 bg-[#030614]/95 backdrop-blur-md">

        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/5 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_12px_rgba(6,182,212,0.2)] group-hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] transition-shadow">
              <Image src="/logo.png" alt="Mailmind Logo" width={32} height={32} className="object-cover w-full h-full" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">{siteConfig.siteName}</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map(item => {
            if (item.kind === "leaf") {
              const isActive = pathname === item.href ||
                (item.href !== "/app" && item.href !== "/dashboard" &&
                 pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]"
                      : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <Icon size={17} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  {item.label}
                </Link>
              );
            }

            // Group
            const isOpen   = !!expanded[item.id];
            const active   = groupIsActive(item, pathname);
            const Icon     = item.icon;

            return (
              <div key={item.id}>
                {/* Group header */}
                <button
                  onClick={() => toggle(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    active
                      ? "text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <Icon
                    size={17}
                    className={active ? "text-primary" : "text-muted-foreground"}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={13}
                    className={cn(
                      "transition-transform duration-200 text-white/20",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {/* Children */}
                {isOpen && (
                  <div className="ml-8 mt-0.5 mb-1 space-y-0.5 border-l border-white/[0.06] pl-3">
                    {(() => {
                      const activeHref = bestActiveChildHref(item.children, pathname);
                      return item.children.map(child => {
                      const childActive = child.href === activeHref;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "block px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                            childActive
                              ? "text-primary bg-primary/8"
                              : "text-white/40 hover:text-white/80 hover:bg-white/[0.03]"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    });
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Support + Back to site */}
        <div className="p-4 border-t border-white/5 space-y-0.5">
          <button
            onClick={() => setSupportOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/[0.04] transition-all duration-200"
          >
            <HelpCircle size={17} className="text-muted-foreground" />
            Support
          </button>
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-muted-foreground hover:text-white transition-colors rounded-xl hover:bg-white/[0.04]"
          >
            <ArrowLeft size={14} />
            Back to {siteConfig.domain}
          </Link>
        </div>

      </aside>

      {/* Rendered OUTSIDE aside so backdrop-blur doesn't confine it */}
      <SupportDrawer open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
