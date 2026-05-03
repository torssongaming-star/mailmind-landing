"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mail, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Link from "next/link";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const navLinks = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#security", label: "Security" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030614]/80 backdrop-blur-xl"
        aria-label="Main Navigation"
      >
        <div className="container mx-auto px-4 md:px-8 max-w-7xl h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 z-50" aria-label="Mailmind Home">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Mail size={20} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Mailmind</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-10 text-sm text-muted-foreground font-medium">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4 z-50">
            <div className="hidden sm:flex items-center gap-6">
              <Button size="default" asChild><Link href="#contact">Book a demo</Link></Button>
            </div>
            
            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-label="Toggle mobile menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[#030614] pt-28 px-6 flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            <div className="flex flex-col gap-6 text-xl font-semibold text-white">
              {navLinks.map((link) => (
                <a 
                  key={link.href} 
                  href={link.href} 
                  className="py-4 border-b border-white/5 hover:text-primary transition-colors block"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-8">
              <Button className="w-full text-lg h-14" asChild onClick={() => setIsOpen(false)}>
                <Link href="#contact">Book a demo</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
