import { ReactNode } from "react"
import { GradientCard } from "./GradientCard"

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  delay?: number
}

export function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <GradientCard
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      innerClassName="flex flex-col h-full"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#050B1C] to-white/5 border border-white/10 flex items-center justify-center text-primary mb-6 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] group-hover:scale-110 group-hover:text-cyan-300 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 tracking-wide">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-base">
        {description}
      </p>
    </GradientCard>
  )
}
