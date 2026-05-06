/**
 * /app/settings — AI behaviour + case types editor.
 *
 * Server component loads current state, then hands off to client editors.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getAiSettings, listCaseTypes, defaultAiSettings } from "@/lib/app/threads";
import { AiSettingsEditor } from "./AiSettingsEditor";
import { CaseTypesEditor } from "./CaseTypesEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!account.access.canUseApp) redirect("/app");

  const [settings, caseTypes] = await Promise.all([
    getAiSettings(account.organization.id),
    listCaseTypes(account.organization.id),
  ]);

  // Settings dates are not serialisable — pass strings to the client component
  const initialSettings = settings ?? defaultAiSettings(account.organization.id);

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">

      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">App settings</p>
          <h1 className="text-2xl font-bold text-white">Configure AI behaviour</h1>
        </div>
        <Link href="/app" className="text-xs text-muted-foreground hover:text-white transition-colors">
          ← App home
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">AI tone &amp; language</h2>
        <p className="text-xs text-muted-foreground">
          How the AI sounds when replying to your customers. Applies to every draft.
        </p>
        <AiSettingsEditor
          initial={{
            tone:            initialSettings.tone,
            language:        initialSettings.language,
            maxInteractions: initialSettings.maxInteractions,
            signature:       initialSettings.signature,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Case types</h2>
        <p className="text-xs text-muted-foreground">
          Categories the AI uses to classify incoming emails. For each type, define
          which fields the AI must collect from the customer before routing the case.
        </p>
        <CaseTypesEditor initial={caseTypes} />
      </section>

    </main>
  );
}
