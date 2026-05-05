"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Search, Sparkles, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

export function HeroMockup() {
  const [floatY, setFloatY] = React.useState(-15);
  React.useEffect(() => {
    if (window.innerWidth < 768) setFloatY(-8);
  }, []);

  return (
    <motion.div
      animate={{ y: [0, floatY, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      className="relative w-full max-w-2xl mx-auto xl:ml-auto will-change-transform"
    >
      {/* Glow behind mockup */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/20 rounded-full blur-[100px] -z-10" />

      <div className="w-full pb-4 -mb-4">
        <div className="rounded-2xl border border-white/10 bg-[#030614]/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col text-left">

          {/* ── Chrome header (shared) ── */}
          <div className="h-11 border-b border-white/5 bg-white/[0.02] flex items-center justify-between px-4 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            </div>
            {/* Desktop: search bar */}
            <div className="hidden md:flex items-center gap-2 bg-black/40 border border-white/5 rounded-md px-3 py-1 text-xs text-muted-foreground w-64 justify-center">
              <Search size={12} /> Search emails...
            </div>
            {/* Mobile: label */}
            <span className="md:hidden text-xs font-medium text-muted-foreground">{siteConfig.siteName} Inbox</span>
            <div className="w-10" />
          </div>

          {/* ══════════════════════════════════════
              MOBILE LAYOUT  (hidden on md+)
          ══════════════════════════════════════ */}
          <div className="flex md:hidden flex-col gap-2.5 p-3 overflow-hidden">

            {/* 1. Customer email card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 shrink-0">
              <div className="flex items-start gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  SJ
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">Sarah Jenkins</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">10:42 AM</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-px">Order status</span>
                  </div>
                </div>
              </div>
              <div className="text-xs font-semibold text-white mb-1">Where is my order? (#8492)</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                I placed an order 3 days ago with expedited shipping, but the tracking still shows "Pending"...
              </div>
            </div>

            {/* 2. AI Summary card */}
            <div className="bg-primary/[0.06] border border-primary/20 rounded-xl p-3 shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-primary animate-pulse" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI Summary</span>
              </div>
              <ul className="space-y-1">
                <li className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                  <span className="text-primary mt-px shrink-0">•</span>
                  Order #8492 delayed — tracking not updated after 3 days.
                </li>
                <li className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                  <span className="text-primary mt-px shrink-0">•</span>
                  Needs status update and estimated delivery date.
                </li>
              </ul>
            </div>

            {/* 3. AI Draft reply card */}
            <div className="bg-[#030614] border border-white/10 rounded-xl p-3 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Draft ready</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Check size={10} className="text-green-400" /> Context: High
                </div>
              </div>

              <div className="text-[11px] text-foreground/80 leading-relaxed flex-1 overflow-hidden mb-3">
                Hi Sarah,<br />
                I&apos;ve checked order #8492. There was a brief warehouse delay — your package is now with the courier and will arrive tomorrow, in time for your event.<br />
                Apologies for the delay!
              </div>

              <div className="shrink-0 space-y-2">
                <Button
                  size="sm"
                  className="w-full h-10 text-sm font-semibold gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                >
                  <Send size={14} /> Approve reply
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <ShieldCheck size={10} className="text-primary/60" />
                  Human approval required
                </div>
              </div>
            </div>

          </div>

          {/* ══════════════════════════════════════
              DESKTOP LAYOUT  (hidden below md)
          ══════════════════════════════════════ */}
          <div className="hidden md:flex flex-1 overflow-hidden h-[539px]">

            {/* Email List Sidebar */}
            <div className="w-1/3 border-r border-white/5 bg-black/20 flex flex-col">
              <div className="p-3 border-b border-white/5 flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Inbox</span>
                <Badge variant="glass" className="h-4 px-1.5 text-[9px] min-w-0">12</Badge>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Active */}
                <div className="p-3 border-l-2 border-primary bg-primary/5 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white">Sarah Jenkins</span>
                    <span className="text-[10px] text-muted-foreground">10:42 AM</span>
                  </div>
                  <div className="text-xs font-medium text-foreground/80 truncate mb-1">Where is my order?</div>
                  <div className="text-[11px] text-muted-foreground truncate mb-2">I ordered 3 days ago and haven&apos;t...</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-orange-500/30 text-orange-400 bg-orange-500/10 font-medium">Order status</Badge>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10 font-medium">Complaint</Badge>
                  </div>
                </div>
                {/* Inactive 1 */}
                <div className="p-3 border-l-2 border-transparent hover:bg-white/5 cursor-pointer transition-colors border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground/80">Tech Corp</span>
                    <span className="text-[10px] text-muted-foreground">Yesterday</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mb-2">Enterprise pricing inquiry</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10 font-medium">Pricing</Badge>
                  </div>
                </div>
                {/* Inactive 2 */}
                <div className="p-3 border-l-2 border-transparent hover:bg-white/5 cursor-pointer transition-colors border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground/80">Marcus Berg</span>
                    <span className="text-[10px] text-muted-foreground">Mon</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mb-2">Local store pickup delay</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-green-500/30 text-green-400 bg-green-500/10 font-medium">Pickup</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Content & AI Reply */}
            <div className="w-2/3 flex flex-col bg-[#050B1C]/40">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-lg font-bold text-white mb-4">Where is my order? (#8492)</h2>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-xs font-bold text-white shrink-0">SJ</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">Sarah Jenkins <span className="text-muted-foreground text-xs font-normal">&lt;sarah.j@example.com&gt;</span></div>
                    <div className="text-xs text-muted-foreground">To: {siteConfig.supportEmail}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-foreground/80 leading-relaxed">
                  Hi team,<br /><br />
                  I placed an order (#8492) 3 days ago with expedited shipping, but the tracking link still shows &quot;Pending&quot;. Can you please tell me when this will arrive? I need it for an event this weekend.<br /><br />
                  Thanks,<br />Sarah
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-end">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                    <Sparkles size={14} className="animate-pulse" /> Draft ready for review
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Check size={12} className="text-green-400" /> Context match: High
                  </div>
                </div>
                <div className="bg-[#030614] border border-primary/20 rounded-xl p-4 text-sm text-foreground/90 leading-relaxed shadow-[inset_0_0_15px_rgba(6,182,212,0.05)] mb-4">
                  Hi Sarah,<br /><br />
                  I&apos;ve checked order #8492. There was a slight delay at our warehouse, but I&apos;ve personally expedited the fulfillment. Your package has just been handed over to the courier and the tracking link will update shortly.<br /><br />
                  It is scheduled to arrive tomorrow afternoon, well in time for your event.<br /><br />
                  Apologies for the initial delay!<br /><br />
                  Best,<br />{siteConfig.siteName} Support
                </div>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white h-8 px-3 text-xs">Edit draft</Button>
                  <Button size="sm" className="h-8 px-4 text-xs gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    <Send size={12} /> Approve &amp; Send
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
