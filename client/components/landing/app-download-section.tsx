"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedGradientMesh, GSAPScrollReveal, GSAPParallax } from "./shared";
import {
  Smartphone,
  Apple,
  Download,
  Star,
  Shield,
  Zap,
  CheckCircle,
  Activity,
  Heart,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Play Store icon component
function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.609 1.814L13.792 12 3.609 22.186a.996.996 0 0 1-.609-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L14.5 12l3.198-3.492zM5.864 2.658L16.8 8.991l-2.302 2.302-8.634-8.635z" />
    </svg>
  );
}

const appFeatures = [
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description: "AES-256 encryption, HIPAA compliant",
  },
  {
    icon: Zap,
    title: "Works Anywhere",
    description: "Full offline tracking and sync",
  },
  {
    icon: Star,
    title: "4.9 Star Rating",
    description: "Trusted by 50,000+ members",
  },
];

const storeButtons = [
  {
    name: "App Store",
    icon: Apple,
    subtitle: "Download on the",
    href: "#",
    gradient: "from-zinc-800 to-zinc-900",
    hoverGradient: "hover:from-zinc-700 hover:to-zinc-800",
  },
  {
    name: "Google Play",
    icon: PlayStoreIcon,
    subtitle: "Get it on",
    href: "#",
    gradient: "from-zinc-800 to-zinc-900",
    hoverGradient: "hover:from-zinc-700 hover:to-zinc-800",
  },
];

// ─── Screen content variants for cycling ────────────────────────────
const screenVariants = [
  {
    id: "dashboard",
    title: "Wellness Score",
    badge: "+18% this week",
    score: "94",
    pillars: ["Fitness", "Nutrition", "Wellbeing"],
    icon: Brain,
    color: "from-primary to-purple-500",
  },
  {
    id: "fitness",
    title: "Today's Workout",
    badge: "In Progress",
    score: "82%",
    pillars: ["HIIT", "32 min", "480 kcal"],
    icon: Activity,
    color: "from-[#FF9800] to-[#F57C00]",
  },
  {
    id: "wellbeing",
    title: "Wellbeing Index",
    badge: "Optimal",
    score: "96",
    pillars: ["Sleep 8.2h", "Recovery", "HRV 62ms"],
    icon: Heart,
    color: "from-[#5C9CE6] to-[#3B82F6]",
  },
];

// ─── Shimmer wrapper for store buttons ──────────────────────────────
function ShimmerWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden group rounded-lg">
      {children}
      {/* Shimmer sweep on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-lg z-10" />
    </div>
  );
}

// ─── Animated phone with cycling screens ────────────────────────────
function AnimatedPhone() {
  const [activeScreen, setActiveScreen] = useState(0);

  // Auto-cycle screens
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScreen((prev) => (prev + 1) % screenVariants.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const screen = screenVariants[activeScreen];

  return (
    <div className="relative">
      {/* Main phone */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative z-10"
      >
        {/* Phone frame */}
        <div className="relative w-[240px] sm:w-[280px] mx-auto bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[2.5rem] p-2 shadow-2xl shadow-black/50">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-2xl z-20" />

          {/* Screen */}
          <div className="relative bg-background rounded-[2rem] overflow-hidden aspect-[9/19]">
            {/* App UI mockup — cycles through variants */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-purple-500/10">
              {/* Header */}
              <div className="p-4 pt-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Y</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Good morning!</p>
                    <p className="text-xs text-muted-foreground">
                      Here&apos;s your daily briefing
                    </p>
                  </div>
                </div>

                {/* Cycling score card */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={screen.id}
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
                    transition={{ duration: 0.3 }}
                    className="glass-card rounded-xl p-4 border border-primary/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        {screen.title}
                      </span>
                      <span className="text-xs text-green-500">{screen.badge}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center", screen.color)}>
                        <screen.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-3xl font-bold gradient-text">{screen.score}</div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {screen.pillars.map((pillar, i) => (
                        <motion.span
                          key={pillar}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full",
                            i === 0 && "bg-[#FF9800]/20 text-[#FF9800]",
                            i === 1 && "bg-[#4CAF50]/20 text-[#4CAF50]",
                            i === 2 && "bg-[#5C9CE6]/20 text-[#5C9CE6]"
                          )}
                        >
                          {pillar}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Quick actions */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    { icon: "🏃", label: "Workout" },
                    { icon: "🥗", label: "Meals" },
                    { icon: "😴", label: "Sleep" },
                  ].map((action, i) => (
                    <motion.div
                      key={action.label}
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="glass-card rounded-lg p-2 text-center"
                    >
                      <span className="text-lg">{action.icon}</span>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {action.label}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Activity preview */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                  className="mt-4 glass-card rounded-xl p-3 border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#FF9800] flex items-center justify-center">
                      <Zap className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-medium">Morning HIIT</span>
                  </div>
                  <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#FF9800] to-[#F57C00]"
                      initial={{ width: 0 }}
                      whileInView={{ width: "75%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.9 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    75% completed
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Screen indicator dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {screenVariants.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    activeScreen === i ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Glow effect */}
        <div className="absolute -inset-8 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full blur-3xl -z-10" />
      </motion.div>

      {/* Floating elements with GSAP parallax */}
      <GSAPParallax speed={0.15}>
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="absolute -left-4 sm:-left-12 top-1/4 glass-card rounded-xl p-3 shadow-lg hidden sm:block"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium">Goal achieved!</p>
              <p className="text-[10px] text-muted-foreground">10K steps</p>
            </div>
          </div>
        </motion.div>
      </GSAPParallax>

      <GSAPParallax speed={0.2} direction="down">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="absolute -right-4 sm:-right-12 top-1/2 glass-card rounded-xl p-3 shadow-lg hidden sm:block"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
              <Star className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <p className="text-xs font-medium">New badge</p>
              <p className="text-[10px] text-muted-foreground">7-day streak</p>
            </div>
          </div>
        </motion.div>
      </GSAPParallax>

      <GSAPParallax speed={0.1}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 }}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 glass-card rounded-full px-4 py-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="text-xs">Available now</span>
          </div>
        </motion.div>
      </GSAPParallax>
    </div>
  );
}

// ─── APP DOWNLOAD SECTION ───────────────────────────────────────────
export function AppDownloadSection() {
  return (
    <section className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <AnimatedGradientMesh intensity={0.18} speed={0.9} blur={100} />
      <div className="absolute top-0 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-purple-500/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Content */}
          <GSAPScrollReveal
            direction="left"
            distance={30}
            duration={0.6}
            className="text-center lg:text-left order-2 lg:order-1"
          >
            <div className="inline-flex items-center gap-2 glass-card px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              <span>Available on iOS and Android</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 md:mb-6">
              Your AI Health Coach,{" "}
              <span className="gradient-text-animated">Always With You</span>
            </h2>

            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
              Personalized fitness plans, real-time nutrition guidance, and
              wellbeing insights -- all powered by AI that learns your patterns
              and adapts to your goals. Download Balencia and see results in weeks,
              not months.
            </p>

            {/* Features */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {appFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="glass-card rounded-xl p-3 sm:p-4 text-center border border-white/10"
                >
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary mx-auto mb-1 sm:mb-2" />
                  <h4 className="text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1">
                    {feature.title}
                  </h4>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Store buttons with shimmer */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              {storeButtons.map((store) => (
                <ShimmerWrapper key={store.name}>
                  <Button
                    asChild
                    size="lg"
                    className={cn(
                      "h-12 sm:h-14 px-5 sm:px-6 bg-gradient-to-r transition-all w-full",
                      store.gradient,
                      store.hoverGradient
                    )}
                  >
                    <a href={store.href} className="flex items-center gap-3">
                      <store.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                      <div className="text-left">
                        <span className="text-[10px] sm:text-xs text-gray-400 block">
                          {store.subtitle}
                        </span>
                        <span className="text-sm sm:text-base font-semibold">
                          {store.name}
                        </span>
                      </div>
                    </a>
                  </Button>
                </ShimmerWrapper>
              ))}
            </div>

            {/* QR Code hint */}
            <p className="text-xs text-muted-foreground mt-4 sm:mt-6">
              Scan the QR code to download instantly
            </p>
          </GSAPScrollReveal>

          {/* Phone mockup */}
          <GSAPScrollReveal
            direction="right"
            distance={30}
            duration={0.6}
            delay={0.2}
            className="flex justify-center order-1 lg:order-2"
          >
            <AnimatedPhone />
          </GSAPScrollReveal>
        </div>
      </div>
    </section>
  );
}
