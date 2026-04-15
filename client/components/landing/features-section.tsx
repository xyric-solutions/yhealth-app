"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Activity, Brain, Heart, Utensils, Moon, Zap, Target, TrendingUp,
  Sparkles, MessageSquare, Smartphone, Watch, Mic, Users,
} from "lucide-react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal, GSAPParallax, FloatingCard } from "./shared";

const pillars = [
  {
    id: "fitness",
    title: "Physical Fitness",
    subtitle: "Train Smarter",
    icon: Activity,
    color: "from-cyan-400 to-cyan-600",
    glowColor: "cyan",
    accentHsl: "190 90% 50%",
    description: "AI-powered workout optimization that adapts to your body, schedule, and goals.",
    features: [
      { icon: Activity, title: "Activity Tracking", desc: "Real-time workout analytics" },
      { icon: Target, title: "Goal Achievement", desc: "Personalized milestone tracking" },
      { icon: TrendingUp, title: "Progress Insights", desc: "Visual performance trends" },
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition",
    subtitle: "Eat Intelligently",
    icon: Utensils,
    color: "from-purple-400 to-purple-600",
    glowColor: "purple",
    accentHsl: "280 80% 60%",
    description: "Smart meal planning and tracking that understands your nutritional needs.",
    features: [
      { icon: Utensils, title: "Meal Planning", desc: "AI-curated diet plans" },
      { icon: Heart, title: "Macro Tracking", desc: "Automated nutrition logging" },
      { icon: Zap, title: "Energy Optimization", desc: "Fuel your performance" },
    ],
  },
  {
    id: "wellbeing",
    title: "Daily Wellbeing",
    subtitle: "Live Balanced",
    icon: Brain,
    color: "from-pink-400 to-pink-600",
    glowColor: "pink",
    accentHsl: "330 80% 60%",
    description: "Holistic wellness support for mental clarity, better sleep, and stress management.",
    features: [
      { icon: Brain, title: "Mental Wellness", desc: "Mindfulness & stress relief" },
      { icon: Moon, title: "Sleep Analysis", desc: "Deep sleep optimization" },
      { icon: Sparkles, title: "Daily Insights", desc: "Personalized wellbeing tips" },
    ],
  },
];

const aiCapabilities = [
  { icon: MessageSquare, title: "Conversational AI", description: "Talk naturally with your AI coach via voice or text" },
  { icon: Mic, title: "Voice & Call Coach", description: "Hands-free voice assistant and live call with your AI coach" },
  { icon: Smartphone, title: "WhatsApp Integration", description: "Get coaching through your favorite messaging app" },
  { icon: Watch, title: "Device Sync", description: "Seamlessly connects with all your fitness devices" },
  { icon: Brain, title: "Predictive Insights", description: "AI anticipates your needs before you ask" },
  { icon: Users, title: "Community & Competitions", description: "Leaderboards, challenges, and support from others" },
];

// ─── Animated connection lines ───────────────────────────────────────
function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="oklch(0.75 0.2 180)" stopOpacity="0" />
          <stop offset="50%" stopColor="oklch(0.75 0.2 180)" />
          <stop offset="100%" stopColor="oklch(0.7 0.2 280)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 0 200 Q 400 100 800 200 T 1600 200"
        stroke="url(#lineGradient1)" strokeWidth="1" fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
    </svg>
  );
}

// ─── 3D Tilt Pillar Card ─────────────────────────────────────────────
function PillarCard({ pillar, index }: { pillar: (typeof pillars)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <GSAPScrollReveal
      direction="up"
      distance={50}
      delay={index * 0.15}
      duration={0.6}
      className="relative group"
    >
      <FloatingCard
        intensity={12}
        perspective={800}
        enableHover={true}
        enableFloat={true}
        floatDuration={6}
        floatDistance={15}
        className="h-full"
      >
        <div ref={ref} className="relative h-full">
          {/* Hover glow */}
          <div className={`absolute -inset-1 bg-gradient-to-r ${pillar.color} rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />

          {/* Animated gradient border sweep */}
          <motion.div
            className="absolute -inset-[1px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden"
            style={{ padding: "1px" }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(from 0deg, transparent 0%, hsl(${pillar.accentHsl}) 10%, transparent 20%)`,
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>

          <div
            className="relative glass-card rounded-3xl p-6 sm:p-8 h-full border border-white/10 backdrop-blur-xl overflow-hidden"
            style={{
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 circuit-pattern opacity-5" />

            {/* Content */}
            <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ duration: 0.5, delay: index * 0.2 + 0.3, type: "spring", stiffness: 200 }}
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${pillar.color} flex items-center justify-center mb-6 glow-${pillar.glowColor}`}
              >
                <pillar.icon className="w-8 h-8 text-white" />
              </motion.div>

              <span className={`text-sm font-medium bg-gradient-to-r ${pillar.color} bg-clip-text text-transparent`}>
                {pillar.subtitle}
              </span>
              <h3 className="text-2xl font-bold mt-1 mb-3">{pillar.title}</h3>
              <p className="text-muted-foreground mb-6">{pillar.description}</p>

              {/* Feature list with spring+bounce entrance */}
              <div className="space-y-4">
                {pillar.features.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.2 + 0.5 + i * 0.12,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.color} bg-opacity-10 flex items-center justify-center shrink-0`}>
                      <feature.icon className="w-5 h-5 text-white/80" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{feature.title}</div>
                      <div className="text-xs text-muted-foreground">{feature.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Decorative corner */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${pillar.color} opacity-5 rounded-bl-full`} />
          </div>
        </div>
      </FloatingCard>
    </GSAPScrollReveal>
  );
}

// ─── AI Feature Badge ────────────────────────────────────────────────
function AIFeatureBadge({ feature, index }: { feature: (typeof aiCapabilities)[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="relative group"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-500 rounded-2xl blur opacity-0 group-hover:opacity-50 transition-opacity" />
      <div className="relative glass-card rounded-2xl p-4 sm:p-5 border border-white/10 backdrop-blur-xl">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-3 sm:mb-4">
          <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <h4 className="font-semibold text-sm sm:text-base mb-1">{feature.title}</h4>
        <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
      </div>
    </motion.div>
  );
}

// ─── FEATURES SECTION ────────────────────────────────────────────────
export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // GSAP scroll-driven scale / opacity / y for the content wrapper
  useGSAP(
    () => {
      if (!contentRef.current || !sectionRef.current) return;

      // Entrance: scale up, fade in, slide up
      gsap.fromTo(
        contentRef.current,
        { scale: 0.85, opacity: 0.3, y: 60 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",   // scrollYProgress 0
            end: "30% center",     // scrollYProgress ~0.3
            scrub: 1,
          },
        }
      );

      // Exit: scale down, fade out, slide up
      gsap.fromTo(
        contentRef.current,
        { scale: 1, opacity: 1, y: 0 },
        {
          scale: 0.9,
          opacity: 0.3,
          y: -60,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "70% center",   // scrollYProgress ~0.7
            end: "bottom top",     // scrollYProgress 1
            scrub: 1,
          },
        }
      );
    },
    sectionRef,
    []
  );

  return (
    <section ref={sectionRef} id="features" className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      {/* Background with gradient mesh */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <AnimatedGradientMesh intensity={0.2} speed={0.8} blur={120} />
      <GSAPParallax speed={0.375} direction="down" className="absolute top-0 left-1/4">
        <div className="w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-primary/10 rounded-full blur-3xl" />
      </GSAPParallax>
      <GSAPParallax speed={0.375} direction="up" className="absolute bottom-0 right-1/4">
        <div className="w-40 sm:w-64 md:w-80 h-40 sm:h-64 md:h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </GSAPParallax>
      <ConnectionLines />

      <div
        ref={contentRef}
        style={{ willChange: "transform, opacity" }}
        className="container mx-auto px-4 relative z-10"
      >
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 md:mb-16">
          <GSAPScrollReveal direction="up" distance={30} delay={0}>
            <div className="inline-flex items-center gap-2 glass-card px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-white/10 backdrop-blur-xl">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              <span>AI-Powered Platform</span>
            </div>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={40} delay={0.1}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 md:mb-6">
              Three Pillars of
              <span className="block gradient-text-animated">Intelligent Wellness</span>
            </h2>
          </GSAPScrollReveal>

          <GSAPScrollReveal direction="up" distance={40} delay={0.2}>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground px-2 sm:px-4">
              Our AI seamlessly integrates fitness, nutrition, and wellbeing into one unified coaching
              experience that understands the connections between all aspects of your health.
            </p>
          </GSAPScrollReveal>
        </div>

        {/* Three Pillars Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16 md:mb-20">
          {pillars.map((pillar, index) => (
            <PillarCard key={pillar.id} pillar={pillar} index={index} />
          ))}
        </div>

        {/* AI Integration Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-2xl sm:rounded-3xl blur-xl opacity-20" />
          <div className="relative glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-12 border border-white/10 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0">
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
                style={{ background: "radial-gradient(circle, oklch(0.75 0.15 180 / 0.1) 0%, transparent 70%)" }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="relative z-10">
              <div className="text-center mb-6 sm:mb-8 md:mb-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ duration: 0.5, delay: 1, type: "spring" }}
                  className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-purple-500 mb-3 sm:mb-4 glow-cyan"
                >
                  <Brain className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                </motion.div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-3">
                  Powered by <span className="gradient-text">Invisible Intelligence</span>
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2">
                  Our AI works quietly in the background, analyzing patterns across all three pillars
                  to deliver insights impossible to discover alone.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {aiCapabilities.map((feature, index) => (
                  <AIFeatureBadge key={feature.title} feature={feature} index={index} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
