import { listAdminOrganizations, getOrganizationsHealth } from "@/lib/admin/queries";
import Link from "next/link";
import { Search, ChevronRight, Building2, Plus, Activity, MessageSquare, Zap } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Organization, Subscription, UsageCounter } from "@/lib/db/schema";

export default async function AdminOrganizationsPage() {
  const orgs = await listAdminOrganizations();
  const orgIds = orgs.map(o => o.id);
  const health = await getOrganizationsHealth(orgIds);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight mb-2">Organizations</h1>
          <p className="text-slate-400">View and manage B2B customer accounts.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search organizations..." 
              className="bg-[#050B1C] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-primary/50 outline-none w-64 transition-all"
            />
          </div>
          
          <Link 
            href="/admin/customers/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/10"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </Link>
        </div>
      </div>

      <div className="bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Organization</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Plan & Status</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Health Metrics</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orgs.map((org: Organization & { subscriptions: Subscription[], usageCounters: UsageCounter[] }) => {
                const sub = org.subscriptions[0];
                const stats = health[org.id] || { threads: 0, aiUsage: 0, lastActivity: null };
                
                return (
                  <tr key={org.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-medium">{org.name}</span>
                          <span className="text-slate-500 text-[10px] font-mono">{org.clerkOrgId || "Personal Account"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 text-xs font-bold uppercase tracking-wider">
                            {sub?.plan || "Free"}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                            sub?.status === "active" ? "bg-green-500/10 text-green-500" : 
                            sub?.status === "trialing" ? "bg-primary/10 text-primary" :
                            "bg-white/5 text-slate-400"
                          )}>
                            {sub?.status || "inactive"}
                          </span>
                        </div>
                        {sub && (
                          <span className="text-slate-500 text-[10px]">
                            Created {format(new Date(org.createdAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                            <MessageSquare className="w-3 h-3 text-violet-500" />
                            Threads
                          </span>
                          <span className="text-white text-sm font-bold">{stats.threads}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            AI Usage
                          </span>
                          <span className="text-white text-sm font-bold">{stats.aiUsage}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                          <Activity className="w-3 h-3 text-emerald-500" />
                          Last Active
                        </span>
                        <span className="text-slate-200 text-xs">
                          {stats.lastActivity 
                            ? formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true, locale: sv })
                            : "No activity"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        href={`/admin/organizations/${org.id}`}
                        className="text-primary hover:text-cyan-300 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-widest"
                      >
                        Details
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic text-sm">
                    No organizations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
