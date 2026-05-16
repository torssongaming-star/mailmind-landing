"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Mail, ArrowRight, Menu, X } from "lucide-react";

const NAV = [
  { href: "#why",       label: "Varför" },
  { href: "#how",       label: "Så funkar det" },
  { href: "#features",  label: "Funktioner" },
  { href: "#security",  label: "Säkerhet" },
  { href: "#pricing",   label: "Priser" },
];

export function Navbar() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav
        className={[
          "fixed top-0 inset-x-0 z-50 transition-all duration-200",
          scrolled
            ? "border-b border-white/8 bg-[hsl(var(--surface-base))]/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        ].join(" ")}
        aria-label="Huvudnavigering"
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/v2" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors">
              <Mail size={14} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">Mailmind</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            {NAV.map(item => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] text-white/55 hover:text-white transition-colors focus-visible:outline-none focus-visible:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <Link
                href="/app"
                className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Öppna app
                <ArrowRight size={12} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden md:inline-flex items-center h-8 px-3 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Logga in
              </Link>
            )}
            <Link
              href="#contact"
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-primary text-[hsl(var(--surface-base))] text-xs font-semibold hover:bg-cyan-300 transition-colors shadow-[0_2px_18px_-2px_hsl(189_94%_43%/0.4)]"
            >
              Boka demo
              <ArrowRight size={12} />
            </Link>
            <button
              onClick={() => setOpen(v => !v)}
              aria-label={open ? "Stäng meny" : "Öppna meny"}
              aria-expanded={open}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/[0.04] transition-colors"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-[hsl(var(--surface-base))]/98 backdrop-blur-xl flex flex-col pt-14 md:hidden animate-in fade-in duration-200">
          <nav className="flex-1 flex flex-col px-6 pt-6 gap-1">
            {NAV.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-base text-white/80 hover:text-white py-3 border-b border-white/8 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={isSignedIn ? "/app" : "/login"}
              onClick={() => setOpen(false)}
              className="text-base text-white/80 hover:text-white py-3 border-b border-white/8 transition-colors"
            >
              {isSignedIn ? "Öppna app" : "Logga in"}
            </Link>
            <Link
              href="#contact"
              onClick={() => setOpen(false)}
              className="mt-6 inline-flex items-center justify-center h-12 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-colors"
            >
              Boka demo
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
