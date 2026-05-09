"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mail, Menu, X, ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

import { siteConfig } from "@/config/site";

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features",     label: "Features"      },
  { href: "#security",     label: "Security"      },
  { href: "#pricing",      label: "Pricing"       },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn } = useAuth();

  // Prevent background scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      {/* ── Main nav bar ── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.1 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030614]/80 backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4 md:px-8 max-w-7xl h-16 md:h-20 flex items-center justify-between">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
            aria-label={`${siteConfig.siteName} — go to homepage`}
          >
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Mail size={18} />
            </div>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white">{siteConfig.siteName}</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-10 text-sm text-muted-foreground font-medium" role="list">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                role="listitem"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 z-50">
            {/* Desktop Auth Actions */}
            <div className="hidden sm:flex items-center gap-4 mr-2">
              {isSignedIn ? (
                <>
                  <Link
                    href="/app"
                    className="text-sm text-muted-foreground hover:text-white transition-colors flex items-center gap-2"
                  >
                    <LayoutDashboard size={14} />
                    App
                  </Link>
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8 ring-1 ring-primary/30 hover:ring-primary/60 transition-all",
                      },
                    }}
                  />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-white transition-colors font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm text-muted-foreground hover:text-white transition-colors font-medium"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>

            {/* Always show Book a demo (except maybe on small screens if crowded) */}
            <div className="hidden sm:block">
              <Button size="default" asChild className="gap-2">
                <Link href="#contact">
                  Book a demo
                  <ArrowRight size={14} className="opacity-60" />
                </Link>
              </Button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen((v) => !v)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
              className="md:hidden relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isOpen ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0,   opacity: 1 }}
                    exit={{   rotate: 90,  opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <X size={20} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={{ rotate: 90,  opacity: 0 }}
                    animate={{ rotate: 0,   opacity: 1 }}
                    exit={{   rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Menu size={20} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* ── Mobile overlay menu ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-40 flex flex-col bg-[#030614]/95 backdrop-blur-md md:hidden"
          >
            {/* Top spacer (matches navbar height) */}
            <div className="h-16 shrink-0" />

            {/* Nav links */}
            <nav className="flex-1 flex flex-col justify-start px-6 pt-8" aria-label="Mobile navigation">
              <ul className="space-y-1">
                {navLinks.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.05, duration: 0.2 }}
                  >
                    <a
                      href={link.href}
                      onClick={close}
                      className="flex items-center justify-between w-full py-4 border-b border-white/8 text-lg font-medium text-white/80 hover:text-white active:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                    >
                      <span>{link.label}</span>
                    </a>
                  </motion.li>
                ))}
                
                {/* Mobile Auth Link */}
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 + navLinks.length * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={isSignedIn ? "/app" : "/login"}
                    onClick={close}
                    className="flex items-center justify-between w-full py-4 border-b border-white/8 text-lg font-medium text-white/80 hover:text-white active:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                  >
                    <span>{isSignedIn ? "App" : "Login"}</span>
                    {isSignedIn ? <LayoutDashboard size={18} className="text-primary/60" /> : <ArrowRight size={18} className="text-white/20" />}
                  </Link>
                </motion.li>

                {!isSignedIn && (
                  <motion.li
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + (navLinks.length + 1) * 0.05, duration: 0.2 }}
                  >
                    <Link
                      href="/signup"
                      onClick={close}
                      className="flex items-center justify-between w-full py-4 border-b border-white/8 text-lg font-medium text-white/80 hover:text-white active:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                    >
                      <span>Sign up</span>
                      <ArrowRight size={18} className="text-white/20" />
                    </Link>
                  </motion.li>
                )}
              </ul>

              {/* Primary CTA — visually strong */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.2 }}
                className="mt-8"
              >
                <Button
                  size="lg"
                  className="w-full h-14 text-base font-semibold gap-2 shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:shadow-[0_0_36px_rgba(6,182,212,0.5)]"
                  asChild
                  onClick={close}
                >
                  <Link href="#contact">
                    Book a demo
                  </Link>
                </Button>
              </motion.div>

              {/* Trust nudge */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.2 }}
                className="text-center text-xs text-muted-foreground mt-4"
              >
                No commitment. 30-minute session.
              </motion.p>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
