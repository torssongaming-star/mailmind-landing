import { getAdminOrganization, listAdminNotes, getOrgHealth, getDryRunStats } from "@/lib/admin/queries";
import { DryRunPanel } from "./DryRunPanel";
import { AutoSendPanel } from "./AutoSendPanel";
import { Building2, Users, CreditCard, Mail, Calendar, ShieldCheck, Activity, MessageSquare, Clock, Zap } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { User, AdminNote } from "@/lib/db/schema";
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

  const sub = o.subscriptions[0];
  const entitlements = o.licenseEntitlement;
  
  // Find current month usage
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const usage = o.usageCounters?.find((u: any) => u.month === currentMonth);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-white text-3xl font-bold tracking-tight">{o.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 text-xs font-mono">{o.id}</span>
              <span className="text-slate-700">•</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                sub?.status === "active" ? "bg-green-500/10 text-green-500" : 
                sub?.status === "trialing" ? "bg-primary/10 text-primary" :
                "bg-white/5 text-slate-400"
              )}>
                {sub?.status || "Free Account"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <select className="bg-[#050B1C] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none text-center">
            <option>Change Status</option>
            <option value="pilot">Mark as Pilot</option>
            <option value="enterprise_lead">Enterprise Lead</option>
            <option value="internal_test">Internal Test</option>
            <option value="churned">Churned</option>
          </select>
          <button className="px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
            Update Profile
          </button>
        </div>
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
              value={`${usage?.aiDraftsUsed || 0} / ${entitlements?.maxAiDraftsPerMonth || 0}`} 
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
                 <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">AI Drafts Used</span>
                 <div className="flex items-center gap-2">
                   <span className="text-white text-lg font-bold">{usage?.aiDraftsUsed || 0}</span>
                   <span className="text-slate-600">/</span>
                   <span className="text-slate-400">{entitlements?.maxAiDraftsPerMonth || 0}</span>
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

           <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-6">
             <h3 className="text-white text-sm font-bold uppercase tracking-widest border-b border-white/5 pb-3">Internal Notes</h3>
             <textarea 
                placeholder="Add internal context..."
                className="w-full bg-[#030614] border border-white/10 rounded-xl p-3 text-xs text-white focus:border-primary/50 outline-none h-24 transition-all resize-none"
              />
              <button className="w-full py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
                Add Organization Note
              </button>

              <div className="space-y-4 pt-4 border-t border-white/5">
                {notes.map((note: AdminNote) => (
                  <div key={note.id} className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                    <span className="text-slate-600 text-[9px] block mb-1">{format(new Date(note.createdAt), "PPp")}</span>
                    <p className="text-slate-400 text-xs leading-relaxed">{note.content}</p>
                  </div>
                ))}
              </div>
           </div>
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
