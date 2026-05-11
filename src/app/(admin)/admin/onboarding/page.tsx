import { UserPlus, Monitor, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProvisionForm } from "./ProvisionForm";

export default function AdminOnboardingPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <UserPlus className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight">Provision ny kund</h1>
          <p className="text-slate-400 mt-1">
            Skapar org · trial-subscription · entitlements · case types · AI-inställningar i ett steg.
          </p>
        </div>
      </div>

      {/* Next step hint */}
      <div className="max-w-2xl bg-[#050B1C] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-4 h-4 text-primary" />
          <div>
            <p className="text-white text-xs font-bold">Nästa steg: Installera Outlook-tillägget</p>
            <p className="text-slate-500 text-[10px] mt-0.5">Sideload-guide med testchecklista för demomöten.</p>
          </div>
        </div>
        <Link
          href="/admin/sideload"
          className="flex items-center gap-1.5 text-primary hover:text-cyan-300 text-xs font-bold transition-colors"
        >
          Öppna guide <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <ProvisionForm />
    </div>
  );
}
