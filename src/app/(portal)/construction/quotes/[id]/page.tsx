/**
 * /construction/quotes/[id] — construction quote detail + builder.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { hasOrgAdminRole } from "@/lib/app/rbac";
import { getQuote } from "@/lib/quoting-common/data/quotes";
import { getCustomer } from "@/lib/quoting-common/data/customers";
import { QuoteStatusBadge } from "@/components/quoting-common/QuoteStatusBadge";
import { ConstructionQuoteBuilder } from "@/components/construction/ConstructionQuoteBuilder";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Offert ${id.slice(0, 8)}… — Construction` };
}

export default async function ConstructionQuoteDetailPage({ params }: Props) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "construction")) redirect("/app");

  const orgId = account.organization!.id;
  const quote = await getQuote(orgId, id);
  if (!quote) notFound();

  const customer = quote.customerId ? await getCustomer(orgId, quote.customerId) : null;
  const customerName = customer?.name ?? "Kund";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between max-w-4xl">
          <div className="flex items-center gap-3">
            <Link href="/construction/quotes" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
              <ArrowLeft size={13} />
              Offerter
            </Link>
            <span className="text-white/20">/</span>
            <div>
              <h1 className="text-base font-semibold text-white leading-tight">
                {quote.number ?? `Offert ${id.slice(0, 8)}…`}
              </h1>
              <p className="text-xs text-white/45 mt-0.5">{customerName}</p>
            </div>
          </div>
          <QuoteStatusBadge status={quote.status} />
        </div>
      </div>

      <main className="flex-1 px-6 py-6 max-w-4xl w-full">
        <ConstructionQuoteBuilder
          quote={quote}
          customerName={customerName}
          customerEmail={customer?.email ?? null}
          canManage={hasOrgAdminRole(account)}
        />
      </main>
    </div>
  );
}
