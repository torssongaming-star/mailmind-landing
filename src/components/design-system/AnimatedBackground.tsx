"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isMobileRef = useRef(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; size: number; delay: number; duration: number; opacity: number }[]
  >([]);

  useEffect(() => {
    setMounted(true);
    const isMobile = window.innerWidth < 768;
    isMobileRef.current = isMobile;

    // Fewer stars on mobile — reduces DOM nodes and compositing
    const count = isMobile ? 40 : 180;

    const newParticles = Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      // Mix of tiny distant stars and slightly larger nearby ones
      size: Math.random() < 0.7 ? Math.random() * 1.2 + 0.4 : Math.random() * 2 + 1.5,
      delay: Math.random() * 12,
      duration: Math.random() * 20 + 15,
      opacity: Math.random() * 0.5 + 0.15,
    }));
    setParticles(newParticles);
  }, []);

  if (!mounted) return null;

  const isMobile = isMobileRef.current;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Deep gradient background — static on mobile, slow-drift on desktop */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#08153A] via-[#030614] to-[#030614]"
        animate={shouldReduceMotion || isMobile ? {} : {
          backgroundPosition: ["0% 0%", "50% 50%", "0% 0%"],
        }}
        transition={{ duration: 40, ease: "linear", repeat: Infinity }}
        style={{ backgroundSize: "200% 200%" }}
      />

      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-neural-grid opacity-30" />

      {/* Star particles — opacity-only on mobile (no y drift = 50% less GPU work) */}
      {!shouldReduceMotion && particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            boxShadow: p.size > 1.5 ? `0 0 ${p.size * 3}px rgba(255,255,255,0.6)` : undefined,
          }}
          initial={{ opacity: 0 }}
          animate={isMobile
            // Mobile: opacity pulse only — no y movement, no compositing of transform
            ? { opacity: [0, p.opacity, 0] }
            // Desktop: full opacity + drift
            : { opacity: [0, p.opacity, 0], y: [0, -50] }
          }
          transition={{
            duration: isMobile ? p.duration * 0.6 : p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}

      {/* Floating glowing orbs — static on mobile to avoid layout thrash */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]"
        animate={shouldReduceMotion || isMobile ? {} : {
          x: [0, 30, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]"
        animate={shouldReduceMotion || isMobile ? {} : {
          x: [0, -40, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0047ff]/5 rounded-full blur-[150px]"
      />
    </div>
  );
}
