import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  color?: "primary" | "red" | "green" | "violet";
}

export function AdminStatCard({ 
  label, 
  value, 
  icon: Icon, 
  description,
  trend,
  color = "primary"
}: AdminStatCardProps) {
  const colors = {
    primary: "text-primary bg-primary/10 border-primary/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    green: "text-green-500 bg-green-500/10 border-green-500/20",
    violet: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  };

  return (
    <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
            trend.positive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          )}>
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{label}</h3>
        <p className="text-white text-3xl font-bold tracking-tight">{value}</p>
        {description && <p className="text-slate-500 text-xs mt-2">{description}</p>}
      </div>
    </div>
  );
}
