import { getAdminStats, listAdminAuditLogs, listFailedInboxes } from "@/lib/admin/queries";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import {
  Users,
  Building2,
  CreditCard,
  Rocket,
  AlertCircle,
  Clock,
  Wifi
} from "lucide-react";
import { isDbConnected } from "@/lib/db";

function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "just nu";
  if (diffMin < 60) return `${diffMin}m sedan`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h sedan`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d sedan`;
}

export default async function AdminDashboard() {
  const [stats, recentLogs, failedInboxes] = await Promise.all([
    getAdminStats(),
    listAdminAuditLogs(10),
    listFailedInboxes(),
  ]);
  const dbConnected = isDbConnected();

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">Internal Dashboard</h1>
        <p className="text-slate-400 text-sm">Overview of Mailmind platform status and growth.</p>
      </div>

      {!dbConnected && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <div>
            <h3 className="text-red-500 font-bold uppercase tracking-widest text-xs">Database Disconnected</h3>
            <p className="text-red-200/60 text-sm">Showing empty admin state. Connect DATABASE_URL to see real data.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <AdminStatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          description="Registered users in database"
          color="primary"
        />
        <AdminStatCard
          label="Organizations"
          value={stats?.totalOrgs ?? 0}
          icon={Building2}
          description="Active B2B teams"
          color="violet"
        />
        <AdminStatCard
          label="Active Subscriptions"
          value={stats?.activeSubscriptions ?? 0}
          icon={CreditCard}
          description="Paid plans (Starter/Team/Business)"
          color="green"
        />
        <AdminStatCard
          label="Pilot Customers"
          value={stats?.pilotCustomers ?? 0}
          icon={Rocket}
          description="In-flight trials & pilots"
          color="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Activity
            </h2>
            <a
              href="/admin/audit"
              className="text-primary text-xs font-bold uppercase tracking-widest hover:text-cyan-300 transition-colors"
            >
              View Audit Log
            </a>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-8">
              No recent administrative actions found.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {recentLogs.map(log => (
                <li key={log.id} className="py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{log.action}</p>
                    <p className="text-xs text-slate-400 truncate">{log.actorEmail}</p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
                    {formatRelative(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Failed Integrations */}
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Failed Integrations
            </h2>
            {failedInboxes.length > 0 && (
              <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                {failedInboxes.length} error{failedInboxes.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {failedInboxes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Wifi className="w-6 h-6 text-green-500" />
              <p className="text-slate-500 text-sm italic text-center">
                All systems operational. No failed integrations detected.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {failedInboxes.map(inbox => (
                <li key={inbox.id} className="py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">
                      {inbox.displayName ?? inbox.email}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {inbox.orgName} · {inbox.provider}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
                    {formatRelative(inbox.lastSyncedAt ?? inbox.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
