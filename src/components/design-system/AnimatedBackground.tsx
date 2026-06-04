"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedBackground
 *
 * Desktop  → 150-particle canvas with requestAnimationFrame loop (rich visual).
 * Mobile   → pure CSS gradient + grid, no JS animation (saves ~800–1500ms INP).
 *
 * The desktop rAF loop competes with hydration on weaker mobile CPUs and was
 * a top INP contributor in real-user metrics. We detect mobile after mount
 * with matchMedia('(max-width: 768px)') and short-circuit to a static layer.
 *
 * SSR safety: `isMobile` starts as false so the server and the first client
 * render agree. The very first paint shows the desktop layer; the CSS fallback
 * swaps in after mount on mobile. Desktop users won't see the swap because
 * isMobile stays false.
 */
export function AnimatedBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detect mobile viewport after mount + react to size class changes.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Modern browsers: addEventListener; Safari < 14 fallback: addListener
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isMobile) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: { x: number; y: number; size: number; speed: number; opacity: number; opacitySpeed: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = 150;

      particles = Array.from({ length: count }).map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() < 0.7 ? Math.random() * 1.2 + 0.4 : Math.random() * 2 + 1.5,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.5 + 0.15,
        opacitySpeed: (Math.random() * 0.01 + 0.005) * (Math.random() < 0.5 ? 1 : -1),
      }));
    };

    window.addEventListener("resize", resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Move upward
        p.y -= p.speed;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }

        // Pulse opacity
        p.opacity += p.opacitySpeed;
        if (p.opacity >= 0.8 || p.opacity <= 0.1) {
          p.opacitySpeed *= -1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;

        if (p.size > 1.5) {
          ctx.shadowBlur = p.size * 3;
          ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#030614]">
      {/* Deep gradient background */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0d2263] via-[#030614] to-[#030614] animate-bg-drift"
        style={{ backgroundSize: "200% 200%" }}
      />

      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-neural-grid opacity-30" />

      {/* High-performance canvas for particles */}
      <canvas
        ref={canvasRef}
        className="hidden md:block absolute inset-0 w-full h-full"
      />

      {/* Floating glowing orbs */}
      <div className="hidden md:block absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-float-slow" />
      <div className="hidden md:block absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] animate-float-slower" />
      <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0047ff]/5 rounded-full blur-[150px]" />
    </div>
  );
}
