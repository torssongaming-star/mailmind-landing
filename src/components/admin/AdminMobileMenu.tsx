"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { adminNavigation } from "./AdminSidebar";

export function AdminMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 -ml-2 mr-2 text-slate-400 hover:text-white lg:hidden"
      >
        <Menu size={20} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-[100dvh] w-[85vw] max-w-[280px] bg-[#050B1C] border-r border-white/5 z-50 lg:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 shrink-0 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Image src="/logo.png" alt="Mailmind Admin Logo" width={40} height={40} className="object-cover w-full h-full" />
                  </div>
                  <div>
                    <h1 className="text-white font-bold tracking-tight">Mailmind</h1>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Admin</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl active:bg-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive 
                          ? "bg-primary/10 text-primary border border-primary/20" 
                          : "text-slate-400 hover:text-white hover:bg-white/5 active:bg-white/10"
                      )}
                    >
                      <item.icon className={cn(
                        "w-5 h-5 transition-colors",
                        isActive ? "text-primary" : "text-slate-500"
                      )} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-6 border-t border-white/5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shrink-0">
                <Link
                  href="/app"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-500" />
                  Back to App
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
