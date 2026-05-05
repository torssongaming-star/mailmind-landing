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
      {/* Icon box — smaller on mobile (2-col), full size on desktop */}
      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-[#050B1C] to-white/5 border border-white/10 flex items-center justify-center text-primary mb-3 md:mb-4 [&_svg]:w-4 [&_svg]:h-4 md:[&_svg]:w-6 md:[&_svg]:h-6 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] group-hover:scale-110 group-hover:text-cyan-300 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-sm md:text-xl font-bold mb-1.5 md:mb-3 tracking-wide leading-snug">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-xs md:text-sm">
        {description}
      </p>
    </GradientCard>
  )
}
