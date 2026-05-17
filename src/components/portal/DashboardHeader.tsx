"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CommandPaletteTrigger } from "./CommandPalette";

interface DashboardHeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const { user } = useUser();
  const pathname = usePathname();

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-white/8 bg-[hsl(var(--surface-base))]/70 backdrop-blur-md shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        {/* Removed hamburger menu because Sidebar.tsx already has a sticky mobile header */}
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
          {description && (
             <p className="text-xs text-muted-foreground hidden sm:block">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CommandPaletteTrigger className="hidden md:inline-flex" />
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
  );
}

