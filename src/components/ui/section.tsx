import { cn } from "@/lib/utils"

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  containerClass?: string
}

export function Section({ children, className, containerClass, ...props }: SectionProps) {
  return (
    <section className={cn("py-14 md:py-32 relative", className)} {...props}>
      <div className={cn("container mx-auto px-6 md:px-8 max-w-7xl relative z-10", containerClass)}>
        {children}
      </div>
    </section>
  )
}
