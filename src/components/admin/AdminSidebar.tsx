"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Rocket,
  BookOpen,
  History,
  Activity,
  ChevronLeft,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview",       href: "/admin",               icon: LayoutDashboard },
  { name: "Provision kund", href: "/admin/onboarding",    icon: UserPlus },
  { name: "Users",          href: "/admin/users",         icon: Users },
  { name: "Organizations",  href: "/admin/organizations", icon: Building2 },
  { name: "Pilots",         href: "/admin/pilots",        icon: Rocket },
  { name: "Knowledge Base", href: "/admin/knowledge",     icon: BookOpen },
  { name: "Audit Log",      href: "/admin/audit",         icon: History },
  { name: "Health",         href: "/admin/health",        icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#050B1C] border-r border-white/5 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight">Mailmind</h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Admin</span>
              <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 text-[9px] font-bold text-red-500 border border-red-500/20 uppercase">Internal</span>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-white/5">
        <Link
          href="/app"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
