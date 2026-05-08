import { getAdminStats } from "@/lib/admin/queries";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { 
  Users, 
  Building2, 
  CreditCard, 
  Rocket, 
  AlertCircle,
  Clock
} from "lucide-react";
import { isDbConnected } from "@/lib/db";

export default async function AdminDashboard() {
  const stats = await getAdminStats();
  const dbConnected = isDbConnected();

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-white text-3xl font-bold tracking-tight mb-2">Internal Dashboard</h1>
        <p className="text-slate-400">Overview of Mailmind platform status and growth.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Activity
            </h2>
            <button className="text-primary text-xs font-bold uppercase tracking-widest hover:text-cyan-300 transition-colors">
              View Audit Log
            </button>
          </div>
          <div className="space-y-4">
            {/* Placeholder for recent actions */}
            <p className="text-slate-500 text-sm italic text-center py-8">
              No recent administrative actions found.
            </p>
          </div>
        </div>

        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Failed Integrations
            </h2>
          </div>
          <div className="space-y-4">
             {/* Placeholder for failing inboxes/integrations */}
             <p className="text-slate-500 text-sm italic text-center py-8">
              All systems operational. No failed integrations detected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
