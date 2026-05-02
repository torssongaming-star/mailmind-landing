"use client";

import { cn } from "@/lib/utils"
import { motion, HTMLMotionProps } from "framer-motion"

interface GradientCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  innerClassName?: string
}

export function GradientCard({ children, className, innerClassName, ...props }: GradientCardProps) {
  return (
    <motion.div 
      className={cn("glass-card glass-card-hover rounded-3xl p-[1px] relative overflow-hidden group", className)}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className={cn("relative z-10 h-full w-full rounded-[calc(1.5rem-1px)] bg-[#050B1C]/80 backdrop-blur-xl p-8", innerClassName)}>
        {children}
      </div>
    </motion.div>
  )
}
