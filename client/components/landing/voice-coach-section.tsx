"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { VoiceCoachSpline } from "./spline/VoiceCoachSpline";
import {
  Mic,
  Waves,
  Headphones,
  Sparkles,
  Phone,
  Clock,
  Globe,
  Zap,
  Volume2,
  Heart,
  Brain,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── Data ────────────────────────────────────────────────────────────

const VOICE_BARS = 32;

const voiceStats = [
  { value: "<200", suffix: "ms", label: "Response time", icon: Zap },
  { value: "12", suffix: "+", label: "Languages", icon: Globe },
  { value: "24", suffix: "/7", label: "Always available", icon: Clock },
];

const scenarios = [
  {
    icon: Activity,
    emoji: "🏃",
    context: "During a run",
    userSays: "I'm struggling on this hill...",
    coachSays:
      "Slow your pace 10%. Your heart rate is spiking — you'll finish stronger if you ease off now.",
    tone: "Motivating",
    toneColor: "text-amber-400 bg-amber-500/10",
    gradient: "from-orange-500 to-amber-500",
    glowColor: "rgba(245, 158, 11, 0.2)",
  },
  {
    icon: Heart,
    emoji: "😰",
    context: "Feeling stressed",
    userSays: "My anxiety is through the roof today.",
    coachSays:
      "I can see your HRV is low. Let's do a 3-minute box breathing — I'll guide you through it.",
    tone: "Calming",
    toneColor: "text-blue-400 bg-blue-500/10",
    gradient: "from-blue-500 to-cyan-500",
    glowColor: "rgba(59, 130, 246, 0.2)",
  },
  {
    icon: Brain,
    emoji: "💼",
    context: "Career decision",
    userSays: "I got a job offer but I'm not sure if I should leave...",
    coachSays:
      "Big decisions deserve space. Let's map out your values — growth, stability, or flexibility? I'll help you see how each option aligns with your life goals.",
    tone: "Thoughtful",
    toneColor: "text-purple-400 bg-purple-500/10",
    gradient: "from-purple-500 to-indigo-500",
    glowColor: "rgba(139, 92, 246, 0.2)",
  },
  {
    icon: Sparkles,
    emoji: "🌅",
    context: "Morning motivation",
    userSays: "I just don't feel motivated today.",
    coachSays:
      "That's okay. Here's one micro-task: write down one sentence about what you want this week. That's it. Small moves count — and I'll check in later.",
    tone: "Encouraging",
    toneColor: "text-emerald-400 bg-emerald-500/10",
    gradient: "from-emerald-500 to-primary",
    glowColor: "rgba(16, 185, 129, 0.2)",
  },
];

const benefits = [
  {
    icon: Mic,
    label: "Natural language coaching",
    desc: "Speak freely — your coach understands context, emotion, and intent.",
    color: "from-cyan-500 to-primary",
  },
  {
    icon: Waves,
    label: "Emotionally intelligent tone",
    desc: "Motivating, calming, or direct — adapts to match your emotional state.",
    color: "from-primary to-purple-500",
  },
  {
    icon: Headphones,
    label: "Hands-free experience",
    desc: "Purpose-built for runs, walks, and daily routines — zero interruption.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Sparkles,
    label: "Biometric-aware responses",
    desc: "Detects stress or fatigue and proactively suggests interventions.",
    color: "from-pink-500 to-primary",
  },
];

// ─── Voice Waveform ──────────────────────────────────────────────────
function VoiceWaveform({ bars = VOICE_BARS }: { bars?: number }) {
  const prefersReducedMotion = useReducedMotionSafe();
  const [heights, setHeights] = useState<number[]>(() =>
    Array(bars)
      .fill(0)
      .map(() => 0.3 + Math.random() * 0.7)
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setHeights(
        Array(bars)
          .fill(0)
          .map((_, i) => {
            // Create a wave pattern from center outward
            const center = bars / 2;
            const dist = Math.abs(i - center) / center;
            const base = 0.2 + (1 - dist) * 0.4;
            return base + Math.random() * 0.5;
          })
      );
    }, 70);
    return () => clearInterval(interval);
  }, [prefersReducedMotion, bars]);

  return (
    <div
      className="flex items-center justify-center gap-[3px] h-16 sm:h-20"
      aria-hidden
    >
      {heights.map((h, i) => {
        const center = bars / 2;
        const dist = Math.abs(i - center) / center;
        const hue = 160 + dist * 40; // teal to cyan gradient
        return (
          <motion.div
            key={i}
            className="rounded-full origin-center"
            initial={false}
            animate={{ scaleY: h }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            style={{
              height: 32,
              width: 3,
              background: `linear-gradient(to top, hsl(${hue}, 80%, 50%), hsl(${hue}, 90%, 65%))`,
              opacity: 0.7 + h * 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Animated Sound Rings ────────────────────────────────────────────
function SoundRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/20"
          style={{
            width: `${120 + i * 50}px`,
            height: `${120 + i * 50}px`,
          }}
          animate={{
            scale: [1, 1.2 + i * 0.1, 1],
            opacity: [0.15 - i * 0.03, 0.05, 0.15 - i * 0.03],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

// ─── Glow Orb ────────────────────────────────────────────────────────
function GlowOrb() {
  const prefersReducedMotion = useReducedMotionSafe();
  return (
    <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32">
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/30 blur-[40px]"
        animate={
          prefersReducedMotion ? {} : { opacity: [0.4, 0.7, 0.4], scale: [0.9, 1.1, 0.9] }
        }
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Middle ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-primary/20"
        animate={
          prefersReducedMotion ? {} : { scale: [1, 1.06, 1], opacity: [0.3, 0.1, 0.3] }
        }
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3,
        }}
      />
      {/* Core */}
      <motion.div
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center overflow-hidden shadow-xl shadow-primary/30"
        animate={prefersReducedMotion ? {} : { scale: [1, 1.04, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-emerald-500" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)",
          }}
        />
        <Mic
          className="relative w-9 h-9 sm:w-10 sm:h-10 text-white"
          strokeWidth={2.5}
        />
      </motion.div>
    </div>
  );
}

// ─── Call Timer ───────────────────────────────────────────────────────
function CallTimer() {
  const [seconds, setSeconds] = useState(47);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return (
    <span className="tabular-nums text-xs font-mono text-muted-foreground/80">
      {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
    </span>
  );
}

// ─── VOICE COACH SECTION ─────────────────────────────────────────────
export function VoiceCoachSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // GSAP section entrance
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0.2, y: 50 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 92%",
            end: "top 45%",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  // GSAP center orb scale
  useGSAP(
    () => {
      if (!centerRef.current) return;
      gsap.fromTo(
        centerRef.current,
        { scale: 0.88, opacity: 0.6 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: centerRef.current,
            start: "top 85%",
            end: "top 40%",
            scrub: 1,
          },
        }
      );
    },
    centerRef,
    []
  );

  // GSAP staggered benefit feature cards
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.from(".vc-feature", {
        y: 50,
        opacity: 0,
        scale: 0.96,
        duration: 0.7,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".vc-feature",
          start: "top 78%",
        },
      });
    },
    sectionRef,
    []
  );

  // GSAP staggered scenario cards
  useGSAP(
    () => {
      if (!cardsRef.current) return;
      const cards = cardsRef.current.querySelectorAll(".scenario-card");
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 50, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 82%",
            toggleActions: "play none none none",
            once: true,
          },
        }
      );
    },
    cardsRef,
    []
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
    >
      {/* Spline 3D background layer */}
      <div className="absolute inset-0 -z-20 pointer-events-none">
        <VoiceCoachSpline />
      </div>

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.14} blur={120} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.04] to-transparent" />
        <div className="absolute top-1/4 left-[15%] w-80 h-80 bg-cyan-500/[0.05] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-[10%] w-96 h-96 bg-purple-500/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={30}
          duration={0.7}
          className="text-center max-w-4xl mx-auto mb-12 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium text-primary mb-6">
            <Phone className="w-3.5 h-3.5" />
            Voice AI Coach
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 tracking-tight leading-[1.1]">
            A personal coach that{" "}
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              speaks your language
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Voice-first guidance that feels like a conversation, not a command.
            Your AI coach delivers real-time, context-aware support through
            natural dialogue — anytime, anywhere.
          </p>
        </GSAPScrollReveal>

        {/* Stats row */}
        <GSAPScrollReveal
          direction="up"
          distance={20}
          stagger={0.08}
          staggerSelector=".voice-stat"
          className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-14 md:mb-20"
        >
          {voiceStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="voice-stat flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/[0.12] bg-white/[0.07] backdrop-blur-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-black tabular-nums text-foreground/90">
                    {stat.value}
                    <span className="text-sm font-bold text-primary/70">
                      {stat.suffix}
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 font-medium">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </GSAPScrollReveal>

        {/* Central voice interface */}
        <div
          ref={centerRef}
          className="flex flex-col items-center justify-center mb-20 md:mb-28"
        >
          <div className="relative w-full max-w-lg">
            {/* Outer frame glow */}
            <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-b from-primary/15 via-transparent to-primary/10 blur-sm" />
            <div className="absolute -inset-px rounded-[30px] bg-gradient-to-b from-white/10 via-white/[0.03] to-white/10" />

            <div className="relative rounded-3xl border border-white/[0.1] bg-background/95 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/30">
              {/* Top bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.12] bg-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="text-xs font-semibold text-foreground/80">
                    Voice session active
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <CallTimer />
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-red-400 rotate-[135deg]" />
                  </div>
                </div>
              </div>

              {/* Voice visualization */}
              <div className="relative px-6 py-10 sm:py-14 flex flex-col items-center gap-8">
                {/* Sound rings */}
                <SoundRings />

                {/* Orb */}
                <GlowOrb />

                {/* Waveform */}
                <div className="w-full max-w-md rounded-2xl bg-white/[0.07] border border-white/[0.12] px-4 py-4 sm:py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Volume2 className="w-4 h-4 text-primary/60 shrink-0" />
                    <span className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                      Live audio
                    </span>
                    <motion.div
                      className="ml-auto flex items-center gap-1.5"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[10px] text-red-400/80 font-medium">
                        REC
                      </span>
                    </motion.div>
                  </div>
                  <VoiceWaveform />
                </div>

                {/* Status text */}
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0.4, 0.8] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="text-sm font-medium text-muted-foreground/90">
                    Continuously learning. Constantly evolving.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scenario Cards */}
        <GSAPScrollReveal
          direction="up"
          distance={24}
          duration={0.6}
          className="text-center mb-10 md:mb-14"
        >
          <h3 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
            Your coach adapts to every moment
          </h3>
          <p className="text-sm text-muted-foreground/90 max-w-lg mx-auto">
            Real scenarios. Real-time intelligence. See how your AI coach
            responds.
          </p>
        </GSAPScrollReveal>

        <div
          ref={cardsRef}
          className="grid sm:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto mb-16 md:mb-20"
        >
          {scenarios.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.context}
                className="scenario-card group relative rounded-3xl border border-white/[0.12] bg-white/[0.07] backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-white/15"
                whileHover={{
                  y: -4,
                  boxShadow: `0 0 60px -15px ${s.glowColor}, 0 0 0 1px rgba(255,255,255,0.1)`,
                }}
              >
                {/* Top gradient line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-px bg-gradient-to-r opacity-40 group-hover:opacity-80 transition-opacity duration-500",
                    s.gradient
                  )}
                />
                {/* Corner glow */}
                <div
                  className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{
                    background: `radial-gradient(circle, ${s.glowColor}, transparent 70%)`,
                  }}
                />

                <div className="relative p-6 sm:p-7">
                  {/* Context header */}
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md",
                        s.gradient
                      )}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/90">
                        {s.context}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                          s.toneColor
                        )}
                      >
                        {s.tone}
                      </span>
                    </div>
                  </div>

                  {/* User message */}
                  <div className="flex justify-end mb-3">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary/15 border border-primary/20 px-4 py-2.5">
                      <p className="text-sm text-foreground/80 italic">
                        &ldquo;{s.userSays}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Coach response */}
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white/[0.04] border border-white/[0.08] px-4 py-2.5">
                      <p className="text-sm text-foreground/85 leading-relaxed">
                        &ldquo;{s.coachSays}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Benefit pills */}
        <GSAPScrollReveal
          as="div"
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
          direction="up"
          distance={28}
          stagger={0.06}
          staggerSelector=".voice-benefit-card"
          start="top 82%"
        >
          {benefits.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="voice-benefit-card vc-feature group flex items-start gap-4 rounded-2xl border border-white/[0.12] bg-white/[0.07] p-5 hover:border-white/15 transition-all duration-300"
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md",
                    item.color
                  )}
                >
                  <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-foreground/90 mb-1">
                    {item.label}
                  </h4>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
