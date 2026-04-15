"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  Layers,
  MonitorSmartphone,
  UserX,
  AlertTriangle,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── Data ────────────────────────────────────────────────────────────

const heroStats = [
  {
    value: 87,
    suffix: "%",
    label: "Abandon their goals",
    sublabel: "within 90 days",
    color: "from-red-500 to-orange-500",
  },
  {
    value: 120,
    prefix: "$",
    suffix: "B",
    label: "Wasted on self-improvement",
    sublabel: "annually worldwide",
    color: "from-amber-500 to-yellow-500",
  },
  {
    value: 5,
    suffix: "+",
    label: "Apps juggled",
    sublabel: "to manage one life",
    color: "from-purple-500 to-pink-500",
  },
];

const painPoints = [
  {
    number: "01",
    icon: Layers,
    stat: { value: 87, suffix: "%" },
    title: "The App Sprawl Problem",
    headline: "One life. Five disconnected apps.",
    description:
      "One app for fitness, another for habits, another for finances, another for journaling. None talk to each other. Your life is fragmented across disconnected tools that can't see the full picture — so neither can you.",
    barLabel: "Users overwhelmed by app fragmentation",
    barValue: 87,
    gradient: "from-red-500 via-rose-500 to-pink-500",
    glowColor: "rgba(239, 68, 68, 0.3)",
  },
  {
    number: "02",
    icon: MonitorSmartphone,
    stat: { value: 73, suffix: "%" },
    title: "The Passive Tracking Trap",
    headline: "You log data. Nothing happens.",
    description:
      "Traditional apps wait for you to figure out what to do. You track steps, log meals, record moods — and get a dashboard of charts no one acts on. That's not coaching. That's note-taking with extra steps.",
    barLabel: "Apps that only track, never coach",
    barValue: 73,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    glowColor: "rgba(245, 158, 11, 0.3)",
  },
  {
    number: "03",
    icon: UserX,
    stat: { value: 5, suffix: "+" },
    title: "The One-Size-Fits-None Approach",
    headline: "Plans designed for someone else.",
    description:
      "Cookie-cutter programs ignore your motivation level, life context, and what actually matters to you. Whether you're barely hanging on or ready to push hard — you get the same generic advice that doesn't fit your reality.",
    barLabel: "Users following mismatched programs",
    barValue: 84,
    gradient: "from-purple-500 via-violet-500 to-indigo-500",
    glowColor: "rgba(139, 92, 246, 0.3)",
  },
];

// ─── Animated Counter ────────────────────────────────────────────────
function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 1800;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Number((eased * value).toFixed(decimals)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value, decimals]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {decimals > 0 ? count.toFixed(decimals) : count}
      {suffix}
    </span>
  );
}

// ─── Animated Progress Bar ───────────────────────────────────────────
function AnimatedBar({
  value,
  gradient,
  label,
  delay = 0,
}: {
  value: number;
  gradient: string;
  label: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground/90 font-medium">
          {label}
        </span>
        <span className="text-xs font-bold text-foreground/60 tabular-nums">
          {value}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.12] overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", gradient)}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${value}%` } : { width: 0 }}
          transition={{
            duration: 1.5,
            ease: [0.22, 1, 0.36, 1],
            delay: delay + 0.3,
          }}
        />
      </div>
    </div>
  );
}

// ─── PROBLEM PAIN SECTION ────────────────────────────────────────────
export function ProblemPainSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Cinematic section entrance with blur
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0, y: 60, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
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

  // Word-by-word title text reveal
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.from(".problem-title-word", {
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
        },
      });
    },
    sectionRef,
    []
  );

  // Cinematic 3D staggered card reveal
  useGSAP(
    () => {
      if (!cardsRef.current) return;
      const cards = cardsRef.current.querySelectorAll(".pain-card");
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 60, scale: 0.92, rotateX: 8 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          transformPerspective: 1200,
          stagger: 0.18,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 80%",
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
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.15} blur={120} />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-red-950/[0.08] to-background" />
        <div className="absolute top-1/4 left-[10%] w-72 h-72 bg-red-500/[0.06] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-[15%] w-96 h-96 bg-orange-500/[0.05] rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={30}
          duration={0.7}
          className="text-center max-w-4xl mx-auto mb-16 md:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-xs sm:text-sm font-medium text-red-400 mb-6">
            <AlertTriangle className="w-3.5 h-3.5" />
            The problem
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]">
            {["People", "don\u2019t", "fail", "at"].map((word) => (
              <span key={word} className="problem-title-word inline-block mr-[0.3em]">
                {word}
              </span>
            ))}
            <span className="block mt-2 bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              {["self-improvement.", "Their", "tools", "do."].map((word) => (
                <span key={word} className="problem-title-word inline-block mr-[0.3em]">
                  {word}
                </span>
              ))}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Fragmented apps, passive tracking, and one-size-fits-all programs
            leave millions stuck in an endless cycle of starting over. Here&apos;s
            exactly why traditional tools fail you.
          </p>
        </GSAPScrollReveal>

        {/* Hero Stats Row */}
        <GSAPScrollReveal
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mb-20 md:mb-28"
          direction="up"
          distance={24}
          stagger={0.1}
          staggerSelector=".hero-stat"
          start="top 82%"
        >
          {heroStats.map((stat) => (
            <div
              key={stat.label}
              className="hero-stat relative group rounded-2xl border border-white/[0.08] p-6 sm:p-8 text-center overflow-hidden transition-all duration-500 hover:border-white/15"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              {/* Top gradient accent line */}
              <div className={cn("absolute top-0 left-0 right-0 h-px bg-gradient-to-r opacity-50", stat.color)} />

              {/* Background number watermark */}
              <span className={cn("absolute top-2 right-4 text-7xl sm:text-8xl font-black bg-gradient-to-br bg-clip-text text-transparent opacity-[0.04] select-none", stat.color)}>
                {stat.prefix || ""}{stat.value}{stat.suffix}
              </span>

              <p
                className={cn(
                  "text-4xl sm:text-5xl md:text-6xl font-black mb-3 bg-gradient-to-br bg-clip-text text-transparent relative",
                  stat.color
                )}
              >
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix || ""}
                  decimals={stat.value % 1 !== 0 ? 1 : 0}
                />
              </p>
              <p className="text-sm sm:text-base font-semibold text-white/80 mb-1 relative">
                {stat.label}
              </p>
              <p className="text-xs sm:text-sm text-white/40 relative">
                {stat.sublabel}
              </p>
            </div>
          ))}
        </GSAPScrollReveal>

        {/* Pain Point Cards */}
        <div ref={cardsRef} className="max-w-5xl mx-auto space-y-6 md:space-y-8">
          {painPoints.map((pain, i) => {
            const Icon = pain.icon;
            return (
              <motion.div
                key={pain.number}
                className="pain-card group relative rounded-3xl border border-white/[0.12] bg-white/[0.07] backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-white/15"
                whileHover={{
                  boxShadow: `0 0 60px -12px ${pain.glowColor}, 0 0 0 1px rgba(255,255,255,0.1)`,
                }}
              >
                {/* Gradient top border */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-px bg-gradient-to-r opacity-40 group-hover:opacity-80 transition-opacity duration-500",
                    pain.gradient
                  )}
                />

                {/* Corner glow */}
                <div
                  className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{
                    background: `linear-gradient(135deg, ${pain.glowColor}, transparent)`,
                  }}
                />

                <div className="relative p-6 sm:p-8 md:p-10">
                  <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">
                    {/* Left: Number + Icon */}
                    <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-5 shrink-0">
                      <span
                        className={cn(
                          "text-6xl sm:text-7xl md:text-8xl font-black leading-none bg-gradient-to-br bg-clip-text text-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-500 select-none",
                          pain.gradient
                        )}
                      >
                        {pain.number}
                      </span>
                      <div
                        className={cn(
                          "w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                          pain.gradient
                        )}
                      >
                        <Icon
                          className="w-7 h-7 md:w-8 md:h-8 text-white"
                          strokeWidth={2}
                        />
                      </div>
                    </div>

                    {/* Right: Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-[0.2em] mb-2">
                        {pain.title}
                      </p>
                      <h3 className="text-2xl sm:text-3xl font-bold mb-4 tracking-tight text-foreground/90">
                        {pain.headline}
                      </h3>
                      <p className="text-muted-foreground/90 text-sm sm:text-base leading-relaxed mb-6 max-w-2xl">
                        {pain.description}
                      </p>

                      {/* Animated bar */}
                      <AnimatedBar
                        value={pain.barValue}
                        gradient={pain.gradient}
                        label={pain.barLabel}
                        delay={i * 0.15}
                      />
                    </div>

                    {/* Far right: Large stat (desktop only) */}
                    <div className="hidden lg:flex flex-col items-center justify-center shrink-0 px-4">
                      <p
                        className={cn(
                          "text-5xl xl:text-6xl font-black bg-gradient-to-br bg-clip-text text-transparent",
                          pain.gradient
                        )}
                      >
                        <AnimatedCounter
                          value={pain.stat.value}
                          suffix={pain.stat.suffix}
                          decimals={pain.stat.value % 1 !== 0 ? 1 : 0}
                        />
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Transition CTA */}
        <GSAPScrollReveal
          direction="up"
          distance={20}
          duration={0.6}
          delay={0.1}
          className="text-center mt-16 md:mt-20"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground/80">
              This is exactly why we built{" "}
              <span className="text-primary font-bold">Balencia</span>
            </span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
