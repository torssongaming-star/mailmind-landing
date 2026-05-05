"use client";

import { UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";

interface DashboardHeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const { user } = useUser();

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#030614]/60 backdrop-blur-sm shrink-0">
      <div>
        <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <span className="text-xs text-muted-foreground hidden sm:block">
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
  );
}
