/**
 * ProductSwitcher — server component mounted in the Sidebar.
 *
 * Reads the current user's product access and renders workspace links for
 * every non-placeholder product the org is entitled to. Mail is always shown.
 *
 * Only mounted when QUOTING_NAV_ENABLED=1 (controlled in portal layout).
 * When construction/trades flip from placeholder to false in products.ts,
 * they appear here automatically — no code change needed.
 */

import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Mail, Sun } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { PRODUCTS, type PlatformVertical } from "@/config/products";

// Map product key → route root and Lucide icon element
const PRODUCT_META: Record<string, { href: string; icon: React.ReactNode }> = {
  mail:  { href: "/app",   icon: <Mail size={14} /> },
  solar: { href: "/solar", icon: <Sun  size={14} /> },
};

export async function ProductSwitcher() {
  const { userId } = await auth();
  if (!userId) return null;

  let account;
  try {
    account = await getCurrentAccount(userId);
  } catch {
    return null;
  }
  if (!account.user) return null;

  // Build the list of visible entries: non-placeholder products that the org
  // can access. Mail is always included (it's the core product).
  const entries = (Object.values(PRODUCTS) as PlatformVertical[]).filter((p) => {
    if (p.placeholder) return false;
    if (p.key === "mail") return true;
    return hasProductAccess(account, p.key);
  });

  // Only render the switcher when there's more than one workspace to switch to.
  if (entries.length < 2) return null;

  return (
    <div className="px-3 pt-3 pb-1">
      <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest px-1 mb-1.5">
        Workspace
      </p>
      <div className="flex flex-col gap-0.5">
        {entries.map((p) => {
          const meta = PRODUCT_META[p.key];
          if (!meta) return null;
          return (
            <Link
              key={p.key}
              href={meta.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-white/40">{meta.icon}</span>
              {p.displayName}
            </Link>
          );
        })}
      </div>
      <div className="mt-2 border-t border-white/5" />
    </div>
  );
}
