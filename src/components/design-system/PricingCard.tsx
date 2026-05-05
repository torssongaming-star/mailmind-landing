import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface PricingCardProps {
  name: string
  price: string
  description: string
  features: string[]
  popular?: boolean
  ctaText?: string
  delay?: number
}

export function PricingCard({ name, price, description, features, popular, ctaText, delay = 0 }: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`relative flex flex-col p-6 md:p-10 rounded-2xl md:rounded-[2rem] glass-card transition-all duration-500 ${
        popular
          ? "border-primary/40 shadow-[0_0_30px_rgba(6,182,212,0.15)] bg-[#050B1C]/90"
          : "border-white/5 hover:border-white/10"
      }`}
    >
      {/* Top accent line on popular card (replaces scale-105 which causes mobile overflow) */}
      {popular && (
        <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-2xl md:rounded-t-[2rem] bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
      )}

      {/* Most Popular badge */}
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <Badge
            variant="glass"
            className="px-3 py-1 text-xs md:text-sm font-semibold shadow-[0_0_12px_rgba(6,182,212,0.4)] whitespace-nowrap"
          >
            ✦ Most Popular
          </Badge>
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-lg md:text-2xl font-bold mb-2 md:mb-3">{name}</h3>

      {/* Price */}
      <div className="mb-3 md:mb-4 flex items-end gap-1.5">
        <span className="text-4xl md:text-5xl font-bold tracking-tight">{price}</span>
        {price !== "Custom" && (
          <span className="text-muted-foreground text-sm md:text-base mb-1">/month</span>
        )}
      </div>

      {/* Description */}
      <p className="text-muted-foreground text-xs md:text-base mb-5 md:mb-8 leading-relaxed">
        {description}
      </p>

      {/* Feature list */}
      <ul className="space-y-2.5 md:space-y-4 mb-6 md:mb-10 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 md:gap-3">
            <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-primary" />
            </div>
            <span className="text-xs md:text-sm text-foreground/90 leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        variant={popular ? "default" : "outline"}
        size="lg"
        className={`w-full h-12 md:h-14 text-sm md:text-base font-semibold ${
          popular ? "shadow-[0_0_20px_rgba(6,182,212,0.35)]" : "border-white/10 hover:bg-white/5"
        }`}
        asChild
      >
        <Link href="#contact">{ctaText || "Book a demo"}</Link>
      </Button>
    </motion.div>
  )
}
