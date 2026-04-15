"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Users, Activity, Award, Heart, Zap, Globe } from "lucide-react";
import { AnimatedGradientMesh, GSAPScrollReveal, GSAPParallax, FloatingCard } from "./shared";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";

const stats = [
  {
    icon: Users, value: 50, suffix: "K+", label: "Active Users",
    description: "People transforming their health",
    color: "from-cyan-400 to-cyan-600", glowHsl: "190 90% 50%",
  },
  {
    icon: Activity, value: 10, suffix: "M+", label: "Activities Tracked",
    description: "Workouts, steps & more logged",
    color: "from-purple-400 to-purple-600", glowHsl: "280 80% 60%",
  },
  {
    icon: Award, value: 98, suffix: "%", label: "Success Rate",
    description: "Users achieving their goals",
    color: "from-pink-400 to-pink-600", glowHsl: "330 80% 60%",
  },
  {
    icon: Heart, value: 4.9, suffix: "/5", label: "User Rating",
    description: "Based on 10K+ reviews",
    color: "from-amber-400 to-orange-500", glowHsl: "38 90% 55%",
  },
];

const highlights = [
  { icon: Zap, text: "Real-time AI coaching" },
  { icon: Globe, text: "Available in 50+ countries" },
];

// ─── Odometer digit ──────────────────────────────────────────────────
function OdometerDigit({ digit, delay = 0 }: { digit: string; delay?: number }) {
  const isNumber = /\d/.test(digit);

  if (!isNumber) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
        className="inline-block"
      >
        {digit}
      </motion.span>
    );
  }

  const num = parseInt(digit, 10);

  return (
    <span className="inline-block h-[1.1em] overflow-hidden relative" style={{ width: "0.65em" }}>
      <motion.span
        className="inline-flex flex-col items-center"
        initial={{ y: 0 }}
        animate={{ y: `-${num * 1.1}em` }}
        transition={{
          duration: 0.8 + num * 0.08,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="block h-[1.1em] leading-[1.1em]" aria-hidden={n !== num}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

// ─── Odometer counter ────────────────────────────────────────────────
function OdometerCounter({ value, suffix, enabled }: { value: number; suffix: string; enabled: boolean }) {
  const isFloat = !Number.isInteger(value);
  
  // Format the number - keep as is since stats are already in the right format
  const formatted = isFloat ? value.toFixed(1) : value.toString();

  if (!enabled) {
    return <span className="tabular-nums">0{suffix}</span>;
  }

  return (
    <span className="tabular-nums inline-flex items-baseline">
      {formatted.split("").map((char, i) => {
        // Skip periods in odometer animation, just show them
        if (char === ".") {
          return (
            <span key={`${i}-${char}`} className="inline-block">
              {char}
            </span>
          );
        }
        return <OdometerDigit key={`${i}-${char}`} digit={char} delay={i * 0.06} />;
      })}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: formatted.length * 0.06 + 0.3 }}
      >
        {suffix}
      </motion.span>
    </span>
  );
}

// ─── Pre-computed particle positions ─────────────────────────────────
const PARTICLE_CONFIG = Array.from({ length: 20 }).map((_, i) => ({
  id: i,
  left: `${(i * 5.7 + 3) % 100}%`,
  top: `${(i * 7.3 + 11) % 100}%`,
  duration: 3 + (i % 5) * 0.4,
  delay: (i % 8) * 0.25,
}));

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLE_CONFIG.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full bg-primary/30"
          style={{ left: particle.left, top: particle.top }}
          animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3], scale: [1, 1.5, 1] }}
          transition={{ duration: particle.duration, repeat: Infinity, delay: particle.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Magnetic stat card ──────────────────────────────────────────────
function StatCard({ stat, index }: { stat: (typeof stats)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="relative group">
      <GSAPScrollReveal direction="up" distance={40} delay={index * 0.1} className="h-full">
        <FloatingCard
          intensity={10}
          perspective={800}
          enableHover={true}
          enableFloat={true}
          floatDuration={6}
          floatDistance={12}
          className="h-full"
        >
          {/* Glow effect */}
          <div className={`absolute -inset-1 bg-gradient-to-r ${stat.color} rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />

          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="relative glass-card rounded-3xl p-6 sm:p-8 h-full border border-white/10 backdrop-blur-xl overflow-hidden"
            style={{ willChange: "transform" }}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 circuit-pattern opacity-5" />
            <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl`} />

            <div className="relative z-10 text-center" style={{ isolation: "isolate" }}>
              {/* Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={isInView ? { scale: 1, rotate: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 + 0.2, type: "spring" }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg`}
                style={{ transform: "translateZ(0)" }}
              >
                <stat.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </motion.div>

              {/* Odometer value with glow */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 min-h-[3rem] sm:min-h-[3.5rem] md:min-h-[4rem] flex items-center justify-center"
                style={{ 
                  textRendering: "optimizeLegibility",
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                  transform: "translateZ(0)",
                }}
              >
                <motion.span
                  className="gradient-text inline-block"
                  style={{
                    filter: isInView ? `drop-shadow(0 0 8px hsl(${stat.glowHsl} / 0.3))` : "none",
                    transform: "translateZ(0)",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  <OdometerCounter value={stat.value} suffix={stat.suffix} enabled={isInView} />
                </motion.span>
              </motion.div>

              {/* Label */}
              <div 
                className="text-base sm:text-lg font-semibold mb-1"
                style={{
                  textRendering: "optimizeLegibility",
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                }}
              >
                {stat.label}
              </div>
              <p 
                className="text-xs sm:text-sm text-muted-foreground"
                style={{
                  textRendering: "optimizeLegibility",
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                }}
              >
                {stat.description}
              </p>
            </div>

            {/* Animated border glow */}
            <motion.div
              className="absolute inset-0 rounded-3xl border-2 border-transparent pointer-events-none"
              style={{
                background: `linear-gradient(var(--background), var(--background)) padding-box, linear-gradient(135deg, transparent 40%, oklch(0.75 0.2 180 / 0.5) 50%, transparent 60%) border-box`,
              }}
              animate={{ backgroundPosition: ["0% 0%", "200% 200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </FloatingCard>
      </GSAPScrollReveal>
    </div>
  );
}

// ─── STATS SECTION ───────────────────────────────────────────────────
export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // GSAP scroll-driven scale/opacity/y entrance for the content wrapper
  useGSAP(
    () => {
      if (!contentRef.current || !sectionRef.current) return;

      gsap.fromTo(
        contentRef.current,
        { scale: 0.9, opacity: 0.4, y: 50 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "center center",
            scrub: 1,
          },
        }
      );

      // Exit animation: scale down and fade out on scroll past
      gsap.fromTo(
        contentRef.current,
        { scale: 1, opacity: 1, y: 0 },
        {
          scale: 0.95,
          opacity: 0.4,
          y: -50,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "center center",
            end: "bottom top",
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  return (
    <section ref={sectionRef} className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <AnimatedGradientMesh intensity={0.2} speed={0.85} blur={110} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <ParticleField />

      <GSAPParallax speed={0.3} direction="down" className="absolute top-20 left-10">
        <div className="w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </GSAPParallax>
      <GSAPParallax speed={0.4} direction="up" className="absolute bottom-20 right-10">
        <div className="w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </GSAPParallax>

      <div
        ref={contentRef}
        className="container mx-auto px-4 relative z-10"
        style={{ willChange: "transform, opacity" }}
      >
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 md:mb-16">
          <GSAPScrollReveal direction="up" distance={30} delay={0}>
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/10 backdrop-blur-xl">
              <Activity className="w-4 h-4 text-primary" />
              <span>By the Numbers</span>
            </div>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={40} delay={0.1}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Trusted by a
              <span className="block gradient-text-animated">Global Community</span>
            </h2>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={40} delay={0.2}>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
              Join thousands of health-conscious individuals who have discovered
              the power of AI-driven wellness coaching.
            </p>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={30} delay={0.3}>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              {highlights.map((highlight) => (
                <div
                  key={highlight.text}
                  className="flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-white/10 backdrop-blur-xl text-sm"
                >
                  <highlight.icon className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">{highlight.text}</span>
                </div>
              ))}
            </div>
          </GSAPScrollReveal>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} />
          ))}
        </div>

        {/* Bottom line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-12 sm:mt-16 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
      </div>
    </section>
  );
}
