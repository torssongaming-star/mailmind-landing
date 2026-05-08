import { Activity, ShieldCheck, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AdminHealthPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-white text-3xl font-bold tracking-tight mb-2">System Health</h1>
        <p className="text-slate-400">Monitor external dependencies and environment configuration.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-bold">Health Endpoint</h2>
              <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Authenticated via Secret</p>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
            <p className="text-slate-300 text-sm">
              The platform health endpoint is available at:
            </p>
            <code className="block p-3 bg-[#030614] rounded-lg text-primary text-xs font-mono break-all">
              /api/admin/health?secret=YOUR_ADMIN_HEALTH_SECRET
            </code>
            <p className="text-slate-500 text-[10px]">
              Use this endpoint for external monitoring (Pingdom, BetterUptime, etc.)
            </p>
          </div>

          <Link 
            href="/api/admin/health" 
            target="_blank"
            className="inline-flex items-center gap-2 text-primary hover:text-cyan-300 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Open Raw Health JSON
            <Activity className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
          <h2 className="text-white font-bold mb-4">Environment Status</h2>
          <div className="space-y-4">
            <HealthItem label="Database (Neon)" status="ok" />
            <HealthItem label="Authentication (Clerk)" status="ok" />
            <HealthItem label="Payments (Stripe)" status="ok" />
            <HealthItem label="AI Engine (Anthropic)" status="ok" />
            <HealthItem label="Email (Resend)" status="ok" />
            <HealthItem label="Email Inbound (SendGrid)" status="warn" detail="Verify Parse Webhook" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthItem({ label, status, detail }: { label: string, status: "ok" | "warn" | "fail", detail?: string }) {
  const icons = {
    ok: <CheckCircle className="w-4 h-4 text-green-500" />,
    warn: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    fail: <XCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-slate-300 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-slate-500 text-[10px] font-medium">{detail}</span>}
        {icons[status]}
      </div>
    </div>
  );
}
