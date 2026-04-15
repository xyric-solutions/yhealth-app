"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Heart,
  Activity,
  Zap,
  Bot,
  User,
  Brain,
  Shield,
  Sparkles,
  Mic,
  Smile,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── Data ────────────────────────────────────────────────────────────

const script: {
  role: "user" | "ai";
  text: string;
  tone?: "supportive" | "energetic" | "calm";
}[] = [
  {
    role: "user",
    text: "I have a big presentation tomorrow and I can't focus.",
  },
  {
    role: "ai",
    text: "I can see you're stressed. Let's break this down — first, a 5-minute breathing exercise. Then I'll help you outline 3 key talking points. You've got this.",
    tone: "supportive",
  },
  { role: "user", text: "What about my workout today?" },
  {
    role: "ai",
    text: "Given your stress and tomorrow's presentation, let's swap the intense session for a 20-minute walk. Movement helps creativity, and you'll recover for Thursday's strength session.",
    tone: "calm",
  },
  { role: "user", text: "I also haven't journaled in 3 days." },
  {
    role: "ai",
    text: "No guilt. Let's do a quick 2-minute voice journal right now — just tell me one thing you're grateful for and one thing you're worried about. I'll capture it.",
    tone: "energetic",
  },
  { role: "user", text: "My savings goal is behind this month." },
  {
    role: "ai",
    text: "You're $180 short of your monthly target. I noticed you haven't reviewed your subscriptions in a while — want me to flag the ones you haven't used in 30+ days?",
    tone: "supportive",
  },
  { role: "user", text: "Yeah, that would be helpful." },
  {
    role: "ai",
    text: "Done — I found 3 subscriptions totaling $47/month you haven't touched. I've added them to your review list. Small wins compound.",
    tone: "energetic",
  },
  { role: "user", text: "You really do cover everything." },
  {
    role: "ai",
    text: "That's the idea. Fitness, finances, focus, journaling — it's all connected. Your life coach sees the whole picture so you don't have to juggle it alone.",
    tone: "supportive",
  },
];

const toneConfig = {
  supportive: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    icon: Heart,
  },
  energetic: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    icon: Zap,
  },
  calm: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    icon: Smile,
  },
};

const capabilities = [
  {
    icon: Brain,
    label: "Context-aware",
    color: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500/20",
  },
  {
    icon: Heart,
    label: "Emotionally intelligent",
    color: "from-pink-500/20 to-pink-500/5",
    border: "border-pink-500/20",
  },
  {
    icon: Shield,
    label: "Privacy-first",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "border-cyan-500/20",
  },
  {
    icon: TrendingUp,
    label: "Cross-domain intelligence",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/20",
  },
];

// ─── Components ──────────────────────────────────────────────────────

function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [display, setDisplay] = useState("");
  const index = useRef(0);
  const prefersReducedMotion = useReducedMotionSafe();
  const stableOnDone = useCallback(() => onDone?.(), [onDone]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(text); // eslint-disable-line react-hooks/set-state-in-effect -- reduced motion fallback
      stableOnDone();
      return;
    }
    index.current = 0;
    setDisplay("");
    const id = setInterval(() => {
      index.current += 1;
      setDisplay(text.slice(0, index.current));
      if (index.current >= text.length) {
        clearInterval(id);
        stableOnDone();
      }
    }, 22);
    return () => clearInterval(id);
  }, [text, prefersReducedMotion, stableOnDone]);

  return <span>{display}</span>;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary/60"
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function LiveMetric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  unit?: string;
}) {
  const [show, setShow] = useState(value);
  useEffect(() => {
    const t = setInterval(() => {
      setShow(
        (v) =>
          v + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3)
      );
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.07] border border-white/[0.12]">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs text-muted-foreground/80">{label}</span>
        <span className="text-sm font-bold tabular-nums">
          {Math.max(0, show)}
        </span>
        {unit && (
          <span className="text-[10px] text-muted-foreground/70">{unit}</span>
        )}
      </div>
    </div>
  );
}

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

const SCROLL_THRESHOLD_PX = 80;

// ─── AI CHAT DEMO SECTION ───────────────────────────────────────────
export function AIChatDemoSection() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  const isInView = useInView(sectionRef, { amount: 0.2, once: false });

  // GSAP scroll-driven section entrance
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0.3, y: 50 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 90%",
            end: "top 40%",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  const current = script[messageIndex];
  const isAi = current?.role === "ai";
  const visibleMessages = script.slice(0, messageIndex + 1);
  const isLastMessage = (idx: number) => idx === visibleMessages.length - 1;

  useEffect(() => {
    if (isInView && !hasStarted) setHasStarted(true); // eslint-disable-line react-hooks/set-state-in-effect -- scroll trigger
  }, [isInView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messageIndex, typingDone, hasStarted]);

  useEffect(() => {
    if (current?.role === "user") setTypingDone(true); // eslint-disable-line react-hooks/set-state-in-effect -- state machine
  }, [messageIndex, current?.role]);

  useEffect(() => {
    if (!hasStarted || !current || !typingDone) return;
    const nextIndex = (messageIndex + 1) % script.length;
    const nextMsg = script[nextIndex];

    // Show typing indicator before AI messages
    if (nextMsg?.role === "ai") {
      setShowTypingIndicator(true); // eslint-disable-line react-hooks/set-state-in-effect -- typing indicator
      const typingDelay = setTimeout(() => {
        setShowTypingIndicator(false);
        setTypingDone(false);
        setMessageIndex(nextIndex);
      }, isAi ? 2000 : 800);
      return () => clearTimeout(typingDelay);
    }

    const t = setTimeout(() => {
      setTypingDone(false);
      setMessageIndex(nextIndex);
    }, isAi ? 2200 : 1000);
    return () => clearTimeout(t);
  }, [hasStarted, current, typingDone, isAi, messageIndex]);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.14} blur={110} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.04] to-transparent" />
        <div className="absolute top-1/3 right-[10%] w-80 h-80 bg-primary/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-[15%] w-72 h-72 bg-purple-500/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={30}
          duration={0.7}
          className="text-center max-w-4xl mx-auto mb-8 md:mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium text-primary mb-6">
            <Bot className="w-3.5 h-3.5" />
            Live AI Demo
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 tracking-tight leading-[1.1]">
            Meet your{" "}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              AI coach
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Real conversations. Emotional intelligence. Cross-domain awareness.
            Watch a live conversation unfold between you and your
            personal AI life coach.
          </p>
        </GSAPScrollReveal>

        {/* Capability pills */}
        <GSAPScrollReveal
          direction="up"
          distance={20}
          stagger={0.06}
          staggerSelector=".cap-pill"
          className="flex flex-wrap justify-center gap-3 mb-12 md:mb-16"
        >
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.label}
                className={cn(
                  "cap-pill flex items-center gap-2 px-4 py-2 rounded-full border bg-gradient-to-r backdrop-blur-sm text-xs font-medium text-foreground/70",
                  cap.color,
                  cap.border
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cap.label}
              </div>
            );
          })}
        </GSAPScrollReveal>

        {/* Chat Window */}
        <GSAPScrollReveal
          direction="up"
          distance={36}
          duration={0.6}
          delay={0.1}
        >
          <div className="w-full max-w-2xl mx-auto">
            {/* Phone frame */}
            <div className="relative">
              {/* Outer glow */}
              <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-b from-primary/20 via-transparent to-primary/10 blur-sm" />
              <div className="absolute -inset-px rounded-[26px] bg-gradient-to-b from-white/10 via-white/5 to-white/10" />

              <div className="relative rounded-3xl border border-white/[0.12] bg-background/95 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/30">
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.12] bg-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Balencia AI Coach</p>
                      <div className="flex items-center gap-1.5">
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                        <p className="text-[10px] text-emerald-400/80 font-medium">
                          Active now
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Live metrics */}
                  <div className="hidden sm:flex items-center gap-2">
                    <LiveMetric icon={Heart} label="HR" value={72} unit="bpm" />
                    <LiveMetric icon={Activity} label="Steps" value={3842} />
                    <LiveMetric icon={Zap} label="Strain" value={8} />
                  </div>
                </div>

                {/* Mobile metrics bar */}
                <div className="sm:hidden flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] overflow-x-auto">
                  <LiveMetric icon={Heart} label="HR" value={72} unit="bpm" />
                  <LiveMetric icon={Activity} label="Steps" value={3842} />
                  <LiveMetric icon={Zap} label="Strain" value={8} />
                </div>

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="p-4 sm:p-6 min-h-[280px] max-h-[55vh] sm:max-h-[420px] flex flex-col gap-4 overflow-y-auto overflow-x-hidden scroll-smooth"
                >
                  <AnimatePresence initial={false}>
                    {visibleMessages.map((msg, idx) => {
                      const isAiMsg = msg.role === "ai";
                      const showTypewriter = isAiMsg && isLastMessage(idx);
                      const tone = isAiMsg && msg.tone ? toneConfig[msg.tone] : null;
                      const ToneIcon = tone?.icon;

                      return (
                        <motion.div
                          key={idx}
                          initial={
                            prefersReducedMotion
                              ? false
                              : {
                                  opacity: 0,
                                  x: isAiMsg ? -20 : 20,
                                  scale: 0.96,
                                }
                          }
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={springTransition}
                          className={cn(
                            "flex gap-2.5",
                            isAiMsg ? "justify-start" : "justify-end"
                          )}
                        >
                          {/* AI Avatar */}
                          {isAiMsg && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-primary/20">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                          )}

                          <div
                            className={cn(
                              "max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 min-w-0",
                              isAiMsg
                                ? "bg-white/[0.07] border border-white/[0.12] rounded-tl-md"
                                : "bg-primary/15 border border-primary/20 rounded-tr-md"
                            )}
                          >
                            <p className="text-sm leading-relaxed break-words">
                              {isAiMsg && showTypewriter ? (
                                <Typewriter
                                  text={msg.text}
                                  onDone={() => setTypingDone(true)}
                                />
                              ) : (
                                msg.text
                              )}
                              {isAiMsg && showTypewriter && !typingDone && (
                                <motion.span
                                  className="inline-block w-[3px] h-4 ml-0.5 bg-primary rounded-full align-middle"
                                  animate={{ opacity: [1, 0, 1] }}
                                  transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                  }}
                                />
                              )}
                            </p>
                            {tone && ToneIcon && (
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-medium",
                                  tone.bg,
                                  tone.color
                                )}
                              >
                                <ToneIcon className="w-3 h-3" />
                                <span className="capitalize">{msg.tone}</span>
                              </div>
                            )}
                          </div>

                          {/* User Avatar */}
                          {!isAiMsg && (
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                              <User className="w-4 h-4 text-foreground/60" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  <AnimatePresence>
                    {showTypingIndicator && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-2.5"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-white/[0.07] border border-white/[0.12] rounded-2xl rounded-tl-md">
                          <TypingIndicator />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="h-2 shrink-0" aria-hidden />
                </div>

                {/* Input bar */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.12] bg-white/[0.07]">
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.07] border border-white/[0.12]">
                    <span className="text-sm text-muted-foreground/70 select-none">
                      Ask your coach anything...
                    </span>
                  </div>
                  <button className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/[0.12] flex items-center justify-center text-muted-foreground/70">
                    <Mic className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </GSAPScrollReveal>

        {/* Bottom badge */}
        <GSAPScrollReveal
          direction="up"
          distance={16}
          duration={0.5}
          delay={0.2}
          className="text-center mt-10 md:mt-14"
        >
          <p className="text-xs text-muted-foreground/80 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Powered by adaptive AI · Conversations are simulated for demo
          </p>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
