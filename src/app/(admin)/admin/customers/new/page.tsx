"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, ShieldCheck, Zap, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { createCustomerAction } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";
import { PlanKey } from "@/lib/plans";

const PLANS: { id: PlanKey; name: string; description: string }[] = [
  { id: "starter", name: "Starter", description: "500 AI drafts, 1 inbox" },
  { id: "team", name: "Team", description: "2,000 AI drafts, 3 inboxes" },
  { id: "business", name: "Business", description: "5,000 AI drafts, 5 inboxes" },
];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    orgName: "",
    plan: "starter" as PlanKey,
    dryRun: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCustomerAction(formData);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/admin/organizations/${result.organizationId}`);
        }, 1500);
      } else {
        setError(result.error as string);
        setIsSubmitting(false);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-white text-2xl font-bold tracking-tight">Customer Created!</h2>
        <p className="text-slate-400">Redirecting to organization details...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/organizations"
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight">New Customer</h1>
          <p className="text-slate-400">Provision a new organization and owner account.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-violet-500/50" />
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in shake-in duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Mail className="w-3 h-3" />
                Owner Email Address
              </label>
              <input 
                type="email"
                required
                placeholder="customer@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#030614] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                Organization Name
              </label>
              <input 
                type="text"
                required
                placeholder="Company AB"
                value={formData.orgName}
                onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                className="w-full bg-[#030614] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" />
              Select Subscription Plan
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, plan: plan.id })}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all group relative overflow-hidden",
                    formData.plan === plan.id 
                      ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(34,211,238,0.1)]" 
                      : "bg-[#030614] border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">{plan.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{plan.description}</div>
                  {formData.plan === plan.id && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5">
            <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                  <Zap className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Enable Dry-Run Mode</div>
                  <div className="text-[10px] text-slate-500">AI drafts will be created but never sent.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, dryRun: !formData.dryRun })}
                className={cn(
                  "w-12 h-6 rounded-full p-1 transition-all duration-300 relative",
                  formData.dryRun ? "bg-primary" : "bg-slate-700"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-lg",
                  formData.dryRun ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-primary text-black hover:bg-cyan-300 disabled:opacity-50 disabled:hover:bg-primary rounded-2xl font-bold uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                Create Customer Account
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
