"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { HowItWorksSpline } from "./spline/HowItWorksSpline";
import {
  Compass,
  Cpu,
  MessageSquare,
  Trophy,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal, FloatingCard } from "./shared";

const steps = [
  {
    number: "01",
    icon: Compass,
    title: "Tell Us What Matters",
    subtitle: "60-Second Setup",
    description:
      "Share your life goals, priorities, and where you are today. Whether it's fitness, career, relationships, or faith — your AI coach starts by listening.",
    color: "from-cyan-400 to-cyan-600",
    glowColor: "180 80% 55%",
    features: ["Life goals assessment", "Motivation calibration", "Any life domain"],
  },
  {
    number: "02",
    icon: Cpu,
    title: "AI Builds Your Game Plan",
    subtitle: "Intelligent Roadmap",
    description:
      "Our AI decomposes your goals into actionable steps across every life domain — workouts, habits, journal prompts, milestones — all personalized to your motivation level.",
    color: "from-purple-400 to-purple-600",
    glowColor: "280 80% 55%",
    features: ["Goal decomposition", "Cross-domain planning", "Adaptive difficulty"],
  },
  {
    number: "03",
    icon: MessageSquare,
    title: "Get Proactive Coaching",
    subtitle: "AI Reaches Out First",
    description:
      "Your AI coach doesn't wait for you to log in. Morning motivation, evening reflections, timely nudges — it initiates the conversation when it matters most.",
    color: "from-pink-400 to-pink-600",
    glowColor: "330 80% 55%",
    features: ["Proactive nudges", "Emotional intelligence", "Voice & text coaching"],
  },
  {
    number: "04",
    icon: Trophy,
    title: "Watch Your Life Transform",
    subtitle: "Track Everything",
    description:
      "Track progress across every goal. Celebrate wins with XP and achievements. Adjust the plan as you grow — your coach evolves with you.",
    color: "from-amber-400 to-orange-600",
    glowColor: "30 80% 55%",
    features: ["Life Score tracking", "Achievements & XP", "Weekly insights"],
  },
];

// ─── Step Card Component ────────────────────────────────────────────
function StepCard({
  step,
  index,
  isActive,
  isCompleted,
}: {
  step: (typeof steps)[0];
  index: number;
  isActive: boolean;
  isCompleted: boolean;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      className="relative z-10"
    >
      {/* Glow effect */}
      <motion.div
        className={`absolute -inset-1 bg-gradient-to-r ${step.color} rounded-3xl blur-xl`}
        animate={{
          opacity: isActive ? [0.2, 0.35, 0.2] : isCompleted ? 0.1 : 0,
        }}
        transition={
          isActive
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.5 }
        }
      />

      <FloatingCard
        intensity={10}
        perspective={800}
        enableHover={true}
        enableFloat={!isActive}
        floatDuration={6}
        floatDistance={12}
        className="h-full"
      >
        <div
          className={`relative glass-card rounded-3xl p-6 h-full border overflow-hidden group transition-all duration-500 backdrop-blur-xl ${
            isActive
              ? "border-primary/40 shadow-lg shadow-primary/10 scale-[1.02]"
              : isCompleted
                ? "border-white/20"
                : "border-white/10 opacity-60"
          }`}
          style={{ willChange: "transform" }}
        >
          <div className="absolute inset-0 circuit-pattern opacity-5" />

          {/* Step number */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={isInView ? { scale: 1, rotate: 0 } : {}}
            transition={{
              duration: 0.5,
              delay: index * 0.15 + 0.2,
              type: "spring",
            }}
            className="absolute -top-3 -left-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-background to-background/80 border border-white/10 flex items-center justify-center shadow-lg"
          >
            <span className="text-lg font-bold gradient-text">{step.number}</span>
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-primary/60"
                animate={{ scale: [1, 1.3, 1.3], opacity: [0.8, 0, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              />
            )}
          </motion.div>

          {/* Completed checkmark */}
          {isCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-2 right-3 z-20"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </motion.div>
          )}

          {/* Content */}
          <div className="relative z-10 pt-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={
                isInView
                  ? { scale: isActive ? [1, 1.1, 1] : 1 }
                  : {}
              }
              transition={
                isActive
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.5, delay: index * 0.15 + 0.3, type: "spring" }
              }
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}
            >
              <step.icon className="w-7 h-7 text-white" />
            </motion.div>

            <span
              className={`text-xs font-medium uppercase tracking-wider bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}
            >
              {step.subtitle}
            </span>
            <h3 className="text-xl font-bold mt-1 mb-3">{step.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {step.description}
            </p>

            <div className="space-y-2">
              {step.features.map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.15 + 0.5 + i * 0.1,
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 transition-colors duration-300 ${
                      isActive || isCompleted ? "text-primary" : "text-muted-foreground/80"
                    }`}
                  />
                  <span className="text-muted-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div
            className={`absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br ${step.color} opacity-5 rounded-tl-full`}
          />
        </div>
      </FloatingCard>
    </motion.div>
  );
}

// ─── Central AI visualization ───────────────────────────────────────
function CentralAI() {
  return (
    <div className="relative w-full h-48 flex items-center justify-center mb-16">
      <motion.div
        className="absolute w-40 h-40 rounded-full border border-primary/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {[0, 90, 180, 270].map((angle, i) => (
          <motion.div
            key={angle}
            className="absolute w-2 h-2 rounded-full bg-primary"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${angle}deg) translateX(80px) translateY(-50%)`,
            }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
      </motion.div>

      <motion.div
        className="absolute w-28 h-28 rounded-full border border-purple-500/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center glow-cyan"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Cpu className="w-10 h-10 text-white" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/50"
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 800 200"
      >
        <defs>
          <linearGradient id="connectGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="oklch(0.75 0.2 180)" stopOpacity="0" />
            <stop offset="50%" stopColor="oklch(0.75 0.2 180)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="oklch(0.75 0.2 180)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.line
          x1="0" y1="100" x2="800" y2="100"
          stroke="url(#connectGradient)" strokeWidth="1" strokeDasharray="8 4"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
        />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="absolute -bottom-8 text-center"
      >
        <span className="text-xs text-muted-foreground">Powered by</span>
        <div className="text-sm font-semibold gradient-text">Balencia AI Engine</div>
      </motion.div>
    </div>
  );
}

// ─── GSAP-driven path progress ──────────────────────────────────────
function ScrollDrawPath({ pathLen }: { pathLen: number }) {
  return (
    <div className="hidden lg:block absolute top-1/2 left-0 right-0 -translate-y-1/2 z-0 pointer-events-none" style={{ marginTop: "-2rem" }}>
      <svg className="w-full h-16" viewBox="0 0 1200 64" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pathGradientM" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(180, 80%, 55%)" />
            <stop offset="33%" stopColor="hsl(280, 80%, 55%)" />
            <stop offset="66%" stopColor="hsl(330, 80%, 55%)" />
            <stop offset="100%" stopColor="hsl(30, 80%, 55%)" />
          </linearGradient>
        </defs>
        <path
          d="M 75 32 C 200 32, 250 32, 375 32 S 550 32, 675 32 S 850 32, 975 32 S 1100 32, 1125 32"
          stroke="hsl(var(--primary) / 0.1)" strokeWidth="2" fill="none" strokeDasharray="8 4"
        />
        <path
          d="M 75 32 C 200 32, 250 32, 375 32 S 550 32, 675 32 S 850 32, 975 32 S 1100 32, 1125 32"
          stroke="url(#pathGradientM)" strokeWidth="2.5" fill="none"
          style={{
            strokeDashoffset: `${(1 - pathLen) * 1200}`,
            strokeDasharray: "1200",
            transition: "stroke-dashoffset 0.3s ease-out",
          }}
        />
        <path
          d="M 75 32 C 200 32, 250 32, 375 32 S 550 32, 675 32 S 850 32, 975 32 S 1100 32, 1125 32"
          stroke="url(#pathGradientM)" strokeWidth="8" fill="none" opacity={0.15}
          style={{
            strokeDashoffset: `${(1 - pathLen) * 1200}`,
            strokeDasharray: "1200",
            transition: "stroke-dashoffset 0.3s ease-out",
            filter: "blur(4px)",
          }}
        />
        {[75, 375, 675, 975].map((cx, i) => (
          <circle
            key={i}
            cx={cx} cy={32} r={6}
            fill={pathLen > i * 0.25 + 0.1 ? `hsl(${steps[i].glowColor})` : "hsl(var(--muted))"}
            opacity={pathLen > i * 0.25 + 0.1 ? 1 : 0.3}
            style={{ transition: "fill 0.3s, opacity 0.3s" }}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── HOW IT WORKS SECTION ───────────────────────────────────────────
export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(-1);
  const [pathLen, setPathLen] = useState(0);

  // GSAP staggered entrance for step cards
  useGSAP(
    () => {
      if (!sectionRef.current) return;
      gsap.from(".hiw-step", {
        x: -40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });
    },
    sectionRef,
    []
  );

  // GSAP ScrollTrigger for step progression and path drawing
  useGSAP(
    () => {
      if (!scrollContainerRef.current) return;

      ScrollTrigger.create({
        trigger: scrollContainerRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: false,
        onUpdate: (self) => {
          const progress = self.progress;
          // Map scroll progress to path length
          const mappedPath = gsap.utils.clamp(0, 1, (progress - 0.15) / 0.6);
          setPathLen(mappedPath);

          // Map scroll progress to active step
          if (progress < 0.2) setActiveStep(-1);
          else if (progress < 0.35) setActiveStep(0);
          else if (progress < 0.5) setActiveStep(1);
          else if (progress < 0.65) setActiveStep(2);
          else setActiveStep(3);
        },
      });
    },
    scrollContainerRef,
    []
  );

  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 lg:py-32 relative overflow-hidden"
      ref={scrollContainerRef}
    >
      {/* Spline 3D background layer */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <HowItWorksSpline />
      </div>

      <div className="absolute inset-0 cyber-grid opacity-20" />
      <AnimatedGradientMesh intensity={0.18} speed={0.9} blur={100} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

      <div ref={sectionRef} className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <GSAPScrollReveal direction="up" distance={30}>
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/10 backdrop-blur-xl">
              <ArrowRight className="w-4 h-4 text-primary" />
              <span>Your Journey</span>
            </div>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={40} delay={0.1}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              From Sign-Up to
              <span className="block gradient-text-animated">Your Best Life</span>
            </h2>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={40} delay={0.2}>
            <p className="text-lg text-muted-foreground">
              Your path to your best life starts with a simple conversation. Let
              your AI life coach guide you every step of the way.
            </p>
          </GSAPScrollReveal>
        </div>

        {/* Central AI Visualization */}
        <CentralAI />

        {/* Steps Grid with scroll-drawing path */}
        <div className="relative">
          <ScrollDrawPath pathLen={pathLen} />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div key={step.number} className="hiw-step">
                <StepCard
                  step={step}
                  index={index}
                  isActive={activeStep === index}
                  isCompleted={activeStep > index}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Progress indicator (mobile) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="flex justify-center gap-2 mt-8 lg:hidden"
        >
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                activeStep >= i
                  ? `w-8 bg-gradient-to-r ${step.color}`
                  : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </motion.div>

        {/* CTA */}
        <GSAPScrollReveal direction="up" distance={40} delay={0.3}>
          <div className="text-center mt-16">
            <p className="text-muted-foreground mb-4">
              Ready to start your transformation?
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-primary to-purple-500 text-white font-semibold glow-cyan transition-all duration-300"
              style={{ willChange: "transform" }}
            >
              Begin Your Journey
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </GSAPScrollReveal>
      </div>
    </section>
  );
}
