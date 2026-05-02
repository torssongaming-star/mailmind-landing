import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
      className={`relative flex flex-col p-10 rounded-[2rem] glass-card transition-all duration-500 ${
        popular ? "border-primary/50 shadow-[0_0_30px_rgba(6,182,212,0.15)] bg-[#050B1C]/90 scale-105 z-10" : "border-white/5 hover:border-white/10"
      }`}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge variant="glass" className="px-4 py-1 text-sm">Most Popular</Badge>
        </div>
      )}
      
      <h3 className="text-2xl font-bold mb-3">{name}</h3>
      <div className="mb-4">
        <span className="text-5xl font-bold tracking-tight">{price}</span>
        {price !== "Custom" && <span className="text-muted-foreground ml-2">/mo</span>}
      </div>
      <p className="text-muted-foreground mb-8 min-h-[48px] text-lg">
        {description}
      </p>
      
      <ul className="space-y-5 mb-10 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-4">
            <div className="mt-1 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-primary" />
            </div>
            <span className="text-base text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>
      
      <Button 
        variant={popular ? "default" : "outline"} 
        size="lg"
        className="w-full text-base font-semibold"
      >
        {ctaText || (price === "Custom" ? "Contact Sales" : "Start Free Trial")}
      </Button>
    </motion.div>
  )
}
