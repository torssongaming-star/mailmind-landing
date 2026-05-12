import { getAdminOrganization, listAdminNotes, getOrgHealth, getDryRunStats } from "@/lib/admin/queries";
import { DryRunPanel } from "./DryRunPanel";
import { AutoSendPanel } from "./AutoSendPanel";
import { OrgNotesPanel } from "./OrgNotesPanel";
import { OrgProfilePanel } from "./OrgProfilePanel";
import { Building2, Users, CreditCard, Mail, Calendar, ShieldCheck, Activity, MessageSquare, Clock, Zap } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { User } from "@/lib/db/schema";
import React from "react";
import { LucideIcon } from "lucide-react";

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [org, notes, health, dryRunStats] = await Promise.all([
    getAdminOrganization(id),
    listAdminNotes(id, "organization"),
    getOrgHealth(id),
    getDryRunStats(id),
  ]);

  if (!org) notFound();
  const o = org as any;

  const sub          = o.subscriptions[0];
  const entitlements = o.licenseEntitlement;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl shrink-0">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white text-xl sm:text-3xl font-bold tracking-tight truncate">{o.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-slate-500 text-[10px] sm:text-xs font-mono truncate">{o.id}</span>
              <span className="text-slate-700 hidden sm:inline">•</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-widest",
                sub?.status === "active" ? "bg-green-500/10 text-green-500" : 
                sub?.status === "trialing" ? "bg-primary/10 text-primary" :
                "bg-white/5 text-slate-400"
              )}>
                {sub?.status || "Free Account"}
              </span>
            </div>
          </div>
        </div>

        <OrgProfilePanel
          orgId={id}
          initialStatus={null}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Health Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
              label="Active Threads" 
              value={(health?.threadCount || 0).toString()} 
              icon={MessageSquare} 
              color="text-violet-500" 
              bgColor="bg-violet-500/10"
            />
            <StatCard
              label="AI Drafts (Month)"
              value={`${health?.aiDraftsThisMonth ?? 0} / ${entitlements?.maxAiDraftsPerMonth || "∞"}`}
              icon={Zap}
              color="text-yellow-500"
              bgColor="bg-yellow-500/10"
            />
            <StatCard 
              label="Last Activity" 
              value={health?.lastActivity ? format(new Date(health.lastActivity), "MMM d, HH:mm") : "None"} 
              icon={Activity} 
              color="text-emerald-500" 
              bgColor="bg-emerald-500/10"
            />
          </div>

          {/* Billing & Subscription */}
          <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
            <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <CreditCard className="w-5 h-5 text-green-500" />
              Billing & Subscription
            </h2>
            
            <div className="grid grid-cols-2 gap-8">
              <DetailItem label="Plan" value={sub?.plan || "Free"} icon={ShieldCheck} />
              <DetailItem label="Stripe Customer" value={o.stripeCustomerId || "N/A"} icon={Mail} />
              <DetailItem label="Stripe Subscription" value={sub?.stripeSubscriptionId || "N/A"} icon={Activity} />
              <DetailItem label="Next Invoice" value={sub ? format(new Date(sub.currentPeriodEnd), "PPP") : "N/A"} icon={Calendar} />
            </div>
          </div>

          {/* Usage & Limits */}
          <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
            <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <Activity className="w-5 h-5 text-primary" />
              Usage & Entitlements
            </h2>
            
            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-1">
                 <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">AI Drafts (denna månad)</span>
                 <div className="flex items-center gap-2">
                   <span className="text-white text-lg font-bold">{health?.aiDraftsThisMonth ?? 0}</span>
                   <span className="text-slate-600">/</span>
                   <span className="text-slate-400">{entitlements?.maxAiDraftsPerMonth || "∞"}</span>
                 </div>
               </div>
               <div className="space-y-1">
                 <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Seats Occupied</span>
                 <div className="flex items-center gap-2">
                   <span className="text-white text-lg font-bold">{o.users.length}</span>
                   <span className="text-slate-600">/</span>
                   <span className="text-slate-400">{entitlements?.maxUsers || 0}</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Members */}
          <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
            <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <Users className="w-5 h-5 text-violet-500" />
              Team Members ({o.users.length})
            </h2>
            <div className="divide-y divide-white/5">
              {o.users.map((user: User) => (
                <div key={user.id} className="py-4 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                      <Users className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-medium">{user.email}</span>
                      <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">{user.role}</span>
                    </div>
                  </div>
                  <Link 
                    href={`/admin/users/${user.clerkUserId}`}
                    className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all opacity-0 group-hover:opacity-100"
                  >
                    Manage
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes & Actions */}
        <div className="space-y-8">
           {/* Dry-run panel */}
           <DryRunPanel
             orgId={id}
             dryRunEnabled={dryRunStats?.dryRunEnabled ?? false}
             approved={dryRunStats?.approved ?? 0}
             total={dryRunStats?.total ?? 0}
             pending={dryRunStats?.pending ?? 0}
           />

           {/* Auto-send panel (locked until dry-run threshold is met) */}
           <AutoSendPanel
             orgId={id}
             autoSendEnabled={dryRunStats?.autoSendEnabled ?? false}
             approved={dryRunStats?.approved ?? 0}
           />

           <OrgNotesPanel orgId={id} initial={notes} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bgColor }: { label: string, value: string, icon: LucideIcon, color: string, bgColor: string }) {
  return (
    <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-3 shadow-xl">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-white/5", bgColor)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div>
        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{label}</div>
        <div className="text-white text-xl font-bold mt-1">{value}</div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string, value: string, icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-slate-600" />
        {label}
      </span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}
