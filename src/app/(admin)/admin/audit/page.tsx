import { listAdminAuditLogs } from "@/lib/admin/queries";
import { History, User as UserIcon, Building2, ShieldCheck, Mail, Lock, BookOpen, Activity } from "lucide-react";
import { format } from "date-fns";
import { AdminAuditLog } from "@/lib/db/schema";

export default async function AdminAuditLogPage() {
  const logs: AdminAuditLog[] = await listAdminAuditLogs();

  const getActionIcon = (action: string) => {
    if (action.includes("password")) return <Lock className="w-3 h-3" />;
    if (action.includes("note")) return <History className="w-3 h-3" />;
    if (action.includes("status")) return <ShieldCheck className="w-3 h-3" />;
    if (action.includes("verification")) return <Mail className="w-3 h-3" />;
    if (action.includes("knowledge")) return <BookOpen className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      <div>
        <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight mb-2">Audit Log</h1>
        <p className="text-slate-400 text-sm">Chronological record of all administrative actions.</p>
      </div>

      <div className="bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Actor</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Action</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Target</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log: AdminAuditLog) => (
                <tr key={log.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-white text-xs font-bold">{log.actorEmail}</span>
                      <span className="text-slate-500 text-[10px] font-mono">{log.actorClerkUserId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                        {getActionIcon(log.action)}
                      </div>
                      <span className="text-slate-200 text-xs font-bold uppercase tracking-wider">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.targetClerkUserId && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <UserIcon className="w-3 h-3" />
                        <span className="text-[10px] font-mono">{log.targetClerkUserId}</span>
                      </div>
                    )}
                    {log.targetOrganizationId && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Building2 className="w-3 h-3" />
                        <span className="text-[10px] font-mono">{log.targetOrganizationId}</span>
                      </div>
                    )}
                    {!log.targetClerkUserId && !log.targetOrganizationId && (
                      <span className="text-slate-600 text-[10px]">SYSTEM</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <pre className="text-[10px] text-slate-500 font-mono bg-black/20 p-2 rounded max-w-xs overflow-hidden text-ellipsis">
                      {JSON.stringify(log.metadata)}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic text-sm">
                    Audit log is currently empty.
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
