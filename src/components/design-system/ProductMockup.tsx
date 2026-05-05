"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Inbox, 
  UserCircle, 
  Clock, 
  CheckCircle2, 
  Settings, 
  Search,
  Sparkles,
  Send,
  Edit3,
  UserPlus,
  MoreVertical,
  AlignLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

const emails = [
  {
    id: 1,
    sender: "Sarah Jenkins",
    email: "sarah.j@example.com",
    subject: "Can I change my pickup time?",
    preview: "Hi, I selected 3 PM for my store pickup today, but...",
    time: "10:42 AM",
    tags: [{ label: "Pickup", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" }],
    status: "unread"
  },
  {
    id: 2,
    sender: "Tom Halverson",
    email: "tomh@example.com",
    subject: "My order is not ready",
    preview: "I arrived at the location but was told the package...",
    time: "09:15 AM",
    tags: [{ label: "Order Status", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" }],
    status: "read"
  },
  {
    id: 3,
    sender: "Lisa McDonald",
    email: "lisa.mcd@corp.com",
    subject: "Question about invoice #4921",
    preview: "Hello team, looking at the latest billing cycle...",
    time: "Yesterday",
    tags: [{ label: "Pricing", color: "bg-green-500/10 text-green-400 border-green-500/20" }],
    status: "read"
  },
  {
    id: 4,
    sender: "James Davies",
    email: "jdavies99@gmail.com",
    subject: "Complaint about delivery",
    preview: "The driver left the package in the rain without...",
    time: "Yesterday",
    tags: [{ label: "Complaint", color: "bg-red-500/10 text-red-400 border-red-500/20" }],
    status: "read"
  },
  {
    id: 5,
    sender: "Anna Karlsson",
    email: "anna.k@example.com",
    subject: "Opening hours this weekend?",
    preview: "Are you open on Sunday during the public holiday?",
    time: "Mon",
    tags: [{ label: "General", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" }],
    status: "read"
  }
];

export function ProductMockup() {
  const [activeEmail, setActiveEmail] = useState(emails[0]);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    // Reset typing animation when email changes
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 2500);
    return () => clearTimeout(timer);
  }, [activeEmail.id]);

  return (
    <motion.div
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="w-full max-w-6xl mx-auto p-px rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-white/[0.02] shadow-[0_40px_80px_rgba(0,0,0,0.7),0_0_60px_rgba(6,182,212,0.12)] relative z-10"
    >
      <div className="w-full rounded-2xl bg-[#030614]/95 backdrop-blur-3xl overflow-hidden flex flex-col h-[560px] md:h-[780px] text-left">
      {/* Desktop Layout */}
      <div className="hidden md:flex w-full h-full overflow-x-auto custom-scrollbar flex-col">
        <div className="flex flex-col h-full min-w-[900px]">
          
          {/* Mac-like Header */}
          <div className="h-12 border-b border-white/5 bg-white/[0.02] flex items-center px-4 shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            </div>
            <div className="mx-auto flex items-center gap-2 bg-black/40 border border-white/5 rounded-md px-4 py-1.5 text-xs text-muted-foreground w-80 justify-center shadow-inner">
              <Search size={14} /> Search customers, tickets, or tags...
            </div>
            <div className="w-16" /> {/* Spacer */}
          </div>

          <div className="flex flex-1 overflow-hidden">
            
            {/* Left Sidebar */}
            <div className="w-60 border-r border-white/5 bg-black/40 hidden md:flex flex-col">
              <div className="p-4 flex items-center gap-3 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  {siteConfig.siteName[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{siteConfig.siteName} Team</div>
                  <div className="text-[10px] text-muted-foreground">Pro Plan</div>
                </div>
              </div>
              
              <div className="p-3 space-y-1 mt-2">
                <div className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium flex items-center justify-between border border-primary/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Inbox size={16} /> Inbox
                  </div>
                  <span className="text-xs">12</span>
                </div>
                <div className="px-3 py-2 text-muted-foreground hover:bg-white/5 rounded-lg text-sm font-medium flex items-center justify-between cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <UserCircle size={16} /> Assigned to me
                  </div>
                  <span className="text-xs">4</span>
                </div>
                <div className="px-3 py-2 text-muted-foreground hover:bg-white/5 rounded-lg text-sm font-medium flex items-center justify-between cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <Clock size={16} /> Waiting on customer
                  </div>
                </div>
                <div className="px-3 py-2 text-muted-foreground hover:bg-white/5 rounded-lg text-sm font-medium flex items-center justify-between cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} /> Resolved
                  </div>
                </div>
              </div>
              
              <div className="mt-auto p-3">
                <div className="px-3 py-2 text-muted-foreground hover:bg-white/5 rounded-lg text-sm font-medium flex items-center gap-3 cursor-pointer transition-colors">
                  <Settings size={16} /> Settings
                </div>
              </div>
            </div>

            {/* Middle Column: Email List */}
            <div className="w-full md:w-80 border-r border-white/5 bg-[#02040A] flex flex-col shrink-0">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Inbox size={16} className="text-muted-foreground" /> All Conversations
                </h3>
                <AlignLeft size={16} className="text-muted-foreground" />
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {emails.map((email) => (
                  <div 
                    key={email.id}
                    onClick={() => setActiveEmail(email)}
                    className={cn(
                      "p-4 border-b border-white/5 cursor-pointer transition-all duration-200 relative",
                      activeEmail.id === email.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-sm", email.status === "unread" ? "font-bold text-white" : "font-medium text-foreground/80")}>
                        {email.sender}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{email.time}</span>
                    </div>
                    <div className={cn("text-xs mb-1.5 truncate", email.status === "unread" ? "font-semibold text-white" : "text-muted-foreground")}>
                      {email.subject}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mb-3">
                      {email.preview}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {email.tags.map(tag => (
                        <Badge key={tag.label} variant="outline" className={cn("text-[9px] h-4 px-1.5 py-0 border font-medium uppercase tracking-wider", tag.color)}>
                          {tag.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Thread & AI */}
            <div className="flex-1 flex flex-col bg-[#050B1C]/30 relative overflow-hidden">

              {/* Thread Header */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {activeEmail.sender.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{activeEmail.subject}</h2>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="text-foreground/80">{activeEmail.sender}</span>
                      <span>&lt;{activeEmail.email}&gt;</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 text-muted-foreground">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-white"><UserPlus size={16} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-white"><MoreVertical size={16} /></Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar flex flex-col gap-6">
                
                {/* Customer Message */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 text-sm text-foreground/90 leading-relaxed shadow-sm max-w-[90%]">
                  <div className="text-xs text-muted-foreground mb-3">{activeEmail.time}</div>
                  {activeEmail.id === 1 && (
                    <>
                      Hi team,<br/><br/>
                      I selected 3 PM for my store pickup today, but I am stuck at work. Can I change it to tomorrow morning around 10 AM instead?<br/><br/>
                      Please let me know if I need to do anything in the app.<br/><br/>
                      Thanks,<br/>
                      Sarah
                    </>
                  )}
                  {activeEmail.id !== 1 && (
                    <>{activeEmail.preview} <br/><br/>Please let me know how to proceed.</>
                  )}
                </div>

                {/* AI Summary Glass Panel */}
                <div className="max-w-[90%] ml-auto w-full">
                  <div className="flex items-center gap-2 mb-2 justify-end">
                    <Sparkles size={14} className="text-primary animate-pulse" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI Summary</span>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-xs text-foreground/80 shadow-md border-primary/20 bg-[#030614]/80">
                    <ul className="list-disc list-inside space-y-1">
                      {activeEmail.id === 1 ? (
                        <>
                          <li>Customer wants to reschedule pickup from today 3 PM to tomorrow 10 AM.</li>
                          <li>Action required: Confirm reschedule and explain process (no app changes needed).</li>
                        </>
                      ) : (
                        <li>Customer inquiry requires standard follow-up procedure.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* AI Draft Panel */}
                <div className="max-w-[90%] ml-auto w-full mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Draft ready for review</span>
                    </div>
                    
                    {/* Safer Labels */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-medium">Context match: High</span>
                      <span className="text-[10px] text-muted-foreground font-medium">•</span>
                      <span className="text-[10px] text-muted-foreground font-medium">Human approval required</span>
                    </div>
                  </div>

                  <div className="bg-[#030614] border border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="text-sm text-foreground/90 leading-relaxed relative z-10 min-h-[120px]">
                      <AnimatePresence mode="wait">
                        {isTyping ? (
                          <motion.div
                            key="typing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex gap-1 items-center h-[120px]"
                          >
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            {activeEmail.id === 1 ? (
                              <>
                                Hi Sarah,<br/><br/>
                                No problem at all! I have updated your pickup time to tomorrow morning at 10 AM. <br/><br/>
                                You don't need to do anything in the app; your order will be safely held for you until you arrive.<br/><br/>
                                See you tomorrow!<br/><br/>
                                Best regards,<br/>
                                Support Team
                              </>
                            ) : (
                              <>
                                Hi {activeEmail.sender.split(' ')[0]},<br/><br/>
                                Thank you for reaching out. I'm currently looking into this for you and will get back to you with an update shortly.<br/><br/>
                                Best regards,<br/>
                                Support Team
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5 relative z-10">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-9 px-4 text-xs gap-1.5 border-white/10 bg-white/[0.02] hover:bg-white/5">
                          <Edit3 size={14} /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 px-4 text-xs gap-1.5 border-white/10 bg-white/[0.02] hover:bg-white/5">
                          <UserPlus size={14} /> Assign
                        </Button>
                      </div>
                      <Button size="sm" className="h-9 px-6 text-xs gap-2 font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]">
                        <Send size={14} /> Approve reply
                      </Button>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col h-full overflow-y-auto p-4 gap-6 bg-[#050B1C]/30 relative">

        {/* Thread Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {activeEmail.sender.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{activeEmail.subject}</h2>
            <div className="text-xs text-muted-foreground truncate">{activeEmail.sender}</div>
          </div>
        </div>

        {/* Customer Message */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-xs text-foreground/90 leading-relaxed shadow-sm relative z-10">
          <div className="text-[10px] text-muted-foreground mb-2">{activeEmail.time}</div>
          {activeEmail.id === 1 ? (
            <>
              Hi team,<br/><br/>
              I selected 3 PM for my store pickup today, but I am stuck at work. Can I change it to tomorrow morning around 10 AM instead?<br/><br/>
              Thanks,<br/>
              Sarah
            </>
          ) : (
            <>{activeEmail.preview} <br/><br/>Please let me know how to proceed.</>
          )}
        </div>

        {/* AI Summary */}
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-primary" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">AI Summary</span>
          </div>
          <div className="glass-card rounded-xl p-3 text-xs text-foreground/80 shadow-md border-primary/20 bg-[#030614]/80">
            <ul className="list-disc list-inside space-y-1">
              {activeEmail.id === 1 ? (
                <>
                  <li>Customer wants to reschedule pickup to tomorrow 10 AM.</li>
                  <li>Action: Confirm reschedule (no app changes needed).</li>
                </>
              ) : (
                <li>Customer inquiry requires standard follow-up.</li>
              )}
            </ul>
          </div>
        </div>

        {/* AI Draft */}
        <div className="relative z-10 bg-[#030614] border border-white/10 rounded-xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-2 mb-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20 w-fit">
              <span className="text-[9px] font-bold uppercase tracking-wider">Draft ready for review</span>
            </div>
            <span className="text-[9px] text-muted-foreground font-medium">Context match: High • Approval required</span>
          </div>
          
          <div className="text-xs text-foreground/90 leading-relaxed min-h-[100px]">
            {activeEmail.id === 1 ? (
              <>
                Hi Sarah,<br/><br/>
                No problem! I have updated your pickup time to tomorrow morning at 10 AM.<br/><br/>
                You don't need to do anything in the app. See you tomorrow!<br/><br/>
                Best,<br/>Support Team
              </>
            ) : (
              <>
                Hi {activeEmail.sender.split(' ')[0]},<br/><br/>
                Thank you for reaching out. I'm currently looking into this for you.<br/><br/>
                Best,<br/>Support Team
              </>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-white/5">
            <Button size="sm" className="w-full text-xs font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Send size={14} className="mr-2" /> Approve reply
            </Button>
          </div>
        </div>

      </div>
      </div>
    </motion.div>
  );
}
