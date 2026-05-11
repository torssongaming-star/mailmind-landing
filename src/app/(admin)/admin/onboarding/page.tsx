import { UserPlus } from "lucide-react";
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

      <ProvisionForm />
    </div>
  );
}
