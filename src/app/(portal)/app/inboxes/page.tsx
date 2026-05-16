import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listInboxes } from "@/lib/app/threads";
import { InboxesEditor } from "./InboxesEditor";
import { getTranslations } from "@/lib/i18n";
import { getUserLocale } from "@/lib/i18n/get-locale";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Anslutna inkorgar" };

export const dynamic = "force-dynamic";

export default async function InboxesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const locale = await getUserLocale();
  const { t } = getTranslations(locale);

  const inboxes = await listInboxes(account.organization.id);
  const limit = account.entitlements?.maxInboxes ?? 0;

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">

      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{t("portal.inboxes.header")}</p>
          <h1 className="text-2xl font-bold text-white">{t("portal.inboxes.title")}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t("portal.inboxes.usage", { count: inboxes.length.toString(), limit: limit.toString() })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app" className="text-xs text-muted-foreground hover:text-white px-3 py-1.5 transition-colors">
            ← {t("nav.app")}
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("portal.inboxes.description")}
        </p>
      </div>

      <InboxesEditor
        initial={inboxes.map(i => ({
          id:           i.id,
          email:        i.email,
          displayName:  i.displayName,
          provider:     i.provider,
          status:       i.status,
          forwardedFrom: (i.config as { forwardedFrom?: string | null })?.forwardedFrom ?? null,
        }))}
        canAddMore={inboxes.length < limit}
        limit={limit}
      />
    </main>
  );
}
