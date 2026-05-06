/**
 * /app/inboxes — list connected inboxes + create new mailmind forwarder.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listInboxes } from "@/lib/app/threads";
import { InboxesEditor } from "./InboxesEditor";

export const dynamic = "force-dynamic";

export default async function InboxesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const inboxes = await listInboxes(account.organization.id);
  const limit = account.entitlements?.maxInboxes ?? 0;

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">

      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Inboxes</p>
          <h1 className="text-2xl font-bold text-white">Connected inboxes</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {inboxes.length} of {limit} used
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app" className="text-xs text-muted-foreground hover:text-white px-3 py-1.5 transition-colors">
            ← App home
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Forward email from your existing inbox to your unique Mailmind address.
          We&apos;ll receive incoming messages, generate AI draft replies, and queue
          them for your review.
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
