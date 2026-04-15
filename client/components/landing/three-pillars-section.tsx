"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  Dumbbell,
  Utensils,
  Brain,
  Check,
  Sparkles,
  Activity,
  TrendingUp,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── Data ────────────────────────────────────────────────────────────

const pillars = [
  {
    icon: Dumbbell,
    title: "Fitness",
    tagline: "Precision training, personalized to you.",
    stat: { value: 200, suffix: "+", label: "Workout programs" },
    features: [
      "Adaptive training based on recovery",
      "Wearable-synced analytics",
      "Progressive overload tracking",
      "Real-time form guidance",
    ],
    gradient: "from-cyan-400 via-teal-500 to-emerald-500",
    glowColor: "rgba(34, 211, 238, 0.25)",
    ringColor: "border-cyan-400/30",
    bgGlow: "bg-cyan-500/[0.06]",
  },
  {
    icon: Utensils,
    title: "Nutrition",
    tagline: "Fuel that fits your physiology.",
    stat: { value: 1.2, suffix: "M+", label: "Meals analyzed" },
    features: [
      "AI-generated meal plans",
      "Macro & micronutrient tracking",
      "Dietary preference adaptation",
      "Nutrient gap analysis",
    ],
    gradient: "from-purple-400 via-violet-500 to-indigo-500",
    glowColor: "rgba(167, 139, 250, 0.25)",
    ringColor: "border-purple-400/30",
    bgGlow: "bg-purple-500/[0.06]",
  },
  {
    icon: Brain,
    title: "Wellbeing",
    tagline: "The full picture of how you feel.",
    stat: { value: 24, suffix: "/7", label: "Continuous monitoring" },
    features: [
      "Sleep quality & recovery scoring",
      "Stress biomarker tracking",
      "AI pattern recognition",
      "Proactive interventions",
    ],
    gradient: "from-pink-400 via-rose-500 to-red-500",
    glowColor: "rgba(244, 114, 182, 0.25)",
    ringColor: "border-pink-400/30",
    bgGlow: "bg-pink-500/[0.06]",
  },
];

// ─── Animated Counter ────────────────────────────────────────────────
function AnimatedStat({
  value,
  suffix,
  label,
  className,
}: {
  value: number;
  suffix: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [count, setCount] = useState(0);
  const decimals = value % 1 !== 0 ? 1 : 0;

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 1600;
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
    <div ref={ref} className={cn("text-center", className)}>
      <p className="text-3xl sm:text-4xl font-black tabular-nums">
        {decimals > 0 ? count.toFixed(decimals) : count}
        <span className="text-lg sm:text-xl font-bold opacity-70">
          {suffix}
        </span>
      </p>
      <p className="text-xs text-muted-foreground/80 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Pulsing Ring Icon ───────────────────────────────────────────────
function PulsingIcon({
  icon: Icon,
  gradient,
  ringColor,
}: {
  icon: React.ComponentType<Record<string, unknown>>;
  gradient: string;
  ringColor: string;
}) {
  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      {/* Outer pulsing ring */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-2xl border-2",
          ringColor
        )}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.1, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Inner ring */}
      <motion.div
        className={cn(
          "absolute inset-1 rounded-xl border",
          ringColor
        )}
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.3, 0.05, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3,
        }}
      />
      {/* Icon container */}
      <div
        className={cn(
          "relative w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
          gradient
        )}
      >
        <Icon className="w-8 h-8 text-white" strokeWidth={2} />
      </div>
    </div>
  );
}

// ─── THREE PILLARS SECTION ───────────────────────────────────────────
export function ThreePillarsSection() {
  const sectionRef = useRef<HTMLElement>(null);
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

  // GSAP staggered card reveal with scale
  useGSAP(
    () => {
      if (!cardsRef.current) return;
      const cards = cardsRef.current.querySelectorAll(".pillar-card");
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 70, scale: 0.92, rotateX: 8 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          stagger: 0.12,
          duration: 0.8,
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
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.14} blur={110} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
        <div className="absolute top-1/3 left-[5%] w-80 h-80 bg-cyan-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-[10%] w-72 h-72 bg-pink-500/[0.04] rounded-full blur-[100px]" />
      </div>

      {/* Spotlight Beam — dramatic light cone from above */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full pointer-events-none -z-[1]" aria-hidden="true">
        {/* Main beam cone */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: "280px solid transparent",
            borderRight: "280px solid transparent",
            borderTop: "500px solid hsl(220 80% 70% / 0.06)",
            filter: "blur(30px)",
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Inner bright beam */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: "120px solid transparent",
            borderRight: "120px solid transparent",
            borderTop: "400px solid hsl(220 90% 80% / 0.1)",
            filter: "blur(20px)",
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        {/* Top source glow */}
        <motion.div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 rounded-full"
          style={{
            background: "radial-gradient(ellipse, hsl(220 90% 85% / 0.4) 0%, hsl(260 80% 70% / 0.15) 50%, transparent 80%)",
            filter: "blur(15px)",
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
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
            <Sparkles className="w-3.5 h-3.5" />
            The Balencia Trinity
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 tracking-tight leading-[1.1]">
            One platform.{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Three dimensions
            </span>{" "}
            of health.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
            Fitness, nutrition, and wellbeing — unified by AI that understands
            how each one shapes the others. No more juggling disconnected apps.
          </p>
        </GSAPScrollReveal>

        {/* Central AI badge */}
        <GSAPScrollReveal
          direction="scale"
          duration={0.5}
          delay={0.1}
          className="flex justify-center mb-12 md:mb-16"
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.15, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative flex items-center gap-2 px-5 py-2.5 rounded-full bg-background/80 border border-primary/30 backdrop-blur-sm shadow-lg shadow-primary/10">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground/90">
                Unified by AI
              </span>
              <Activity className="w-4 h-4 text-primary" />
            </div>
          </div>
        </GSAPScrollReveal>

        {/* Pillar Cards */}
        <div
          ref={cardsRef}
          className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-8xl mx-auto"
          style={{ perspective: "1200px" }}
        >
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                className="pillar-card group relative rounded-3xl border border-white/[0.12] bg-white/[0.07] backdrop-blur-sm overflow-hidden transition-all duration-500 hover:border-white/20"
                whileHover={{
                  y: -8,
                  boxShadow: `0 0 80px -20px ${pillar.glowColor}, 0 0 0 1px rgba(255,255,255,0.12)`,
                  transition: { duration: 0.3 },
                }}
              >
                {/* Animated gradient top border */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 group-hover:opacity-100 transition-opacity duration-500",
                    pillar.gradient
                  )}
                />

                {/* Hover background glow */}
                <div
                  className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{
                    background: `radial-gradient(circle, ${pillar.glowColor}, transparent 70%)`,
                  }}
                />

                <div className="relative p-7 sm:p-8 lg:p-9">
                  {/* Icon + Stat row */}
                  <div className="flex items-start justify-between mb-7">
                    <PulsingIcon
                      icon={Icon}
                      gradient={pillar.gradient}
                      ringColor={pillar.ringColor}
                    />
                    <AnimatedStat
                      value={pillar.stat.value}
                      suffix={pillar.stat.suffix}
                      label={pillar.stat.label}
                    />
                  </div>

                  {/* Title + Tagline */}
                  <h3 className="text-2xl font-bold mb-1.5 text-foreground/95">
                    {pillar.title}
                  </h3>
                  <p
                    className={cn(
                      "text-sm font-semibold mb-5 bg-gradient-to-r bg-clip-text text-transparent",
                      pillar.gradient
                    )}
                  >
                    {pillar.tagline}
                  </p>

                  {/* Feature list */}
                  <div className="space-y-3">
                    {pillar.features.map((feature, fi) => (
                      <motion.div
                        key={feature}
                        className="flex items-start gap-3 group/item"
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-30px" }}
                        transition={{
                          delay: fi * 0.08 + i * 0.1,
                          duration: 0.4,
                        }}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded-md bg-gradient-to-br flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                            pillar.gradient
                          )}
                        >
                          <Check
                            className="w-3 h-3 text-white"
                            strokeWidth={3}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground/90 group-hover/item:text-foreground/90 transition-colors">
                          {feature}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Bottom connector line */}
                  <div className="mt-7 pt-5 border-t border-white/[0.12]">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-primary/60" />
                      <span className="text-xs text-muted-foreground/80 font-medium">
                        AI-optimized · Real-time · Adaptive
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom connection line */}
        <GSAPScrollReveal
          direction="up"
          distance={16}
          duration={0.5}
          delay={0.2}
          className="hidden md:flex justify-center mt-10"
        >
          <div className="flex items-center gap-3">
            {pillars.map((p, i) => (
              <div key={p.title} className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full bg-gradient-to-br shadow-sm",
                    p.gradient
                  )}
                />
                {i < pillars.length - 1 && (
                  <div className="w-20 h-px bg-gradient-to-r from-white/10 to-white/10 relative">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/40 to-primary/40"
                      animate={{ scaleX: [0, 1, 0] }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.5,
                      }}
                      style={{ transformOrigin: "left" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
