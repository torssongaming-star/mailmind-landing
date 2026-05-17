"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/portal/DashboardHeader";
import { useI18n } from "@/lib/i18n/context";

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    { name: t("nav.stats"), href: "/app/insights/stats" },
    { name: t("nav.activity"), href: "/app/insights/activity" },
    { name: t("nav.usage"), href: "/app/insights/usage" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader 
        title={t("nav.analytics") || "Insikter"} 
        description="Följ upp din data, aktivitet och resursanvändning."
      />
      
      <div className="border-b border-white/5 bg-[hsl(var(--surface-base))]/50 backdrop-blur-sm sticky top-16 z-10">
        <div className="px-6 flex items-center gap-6">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative py-4 text-sm font-medium transition-colors hover:text-white focus-visible:outline-none",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.name}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
