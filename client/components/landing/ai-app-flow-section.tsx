"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { AnimatedGradientMesh } from "./shared";
import {
  Sparkles,
  MessageCircle,
  Brain,
  Activity,
  Heart,
  Apple,
  Moon,
  TrendingUp,
  Bell,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// App flow steps with animations
const appFlowSteps = [
  {
    id: 1,
    title: "Morning Check-in",
    description: "Start your day with AI insights",
    icon: Bell,
    color: "from-[#00BCD4] to-[#00ACC1]",
    pillar: "wellbeing",
    mockup: {
      greeting: "Good morning, Sarah!",
      insight: "You slept 7.5 hours - 12% better than last week",
      suggestion: "Perfect day for a morning run based on your energy levels",
    },
  },
  {
    id: 2,
    title: "AI Conversation",
    description: "Chat naturally about your goals",
    icon: MessageCircle,
    color: "from-[#7C3AED] to-[#6D28D9]",
    pillar: "wellbeing",
    mockup: {
      userMessage: "I'm feeling low energy today",
      aiResponse:
        "I noticed your sleep was interrupted. Let me suggest a lighter workout and energy-boosting meal plan.",
      action: "View Personalized Plan",
    },
  },
  {
    id: 3,
    title: "Fitness Tracking",
    description: "Smart workout recommendations",
    icon: Activity,
    color: "from-[#FF9800] to-[#F57C00]",
    pillar: "fitness",
    mockup: {
      workout: "HIIT Session",
      duration: "25 min",
      calories: "320 kcal",
      heartRate: "142 bpm",
      progress: 75,
    },
  },
  {
    id: 4,
    title: "Nutrition Guidance",
    description: "Personalized meal suggestions",
    icon: Apple,
    color: "from-[#4CAF50] to-[#388E3C]",
    pillar: "nutrition",
    mockup: {
      meal: "Lunch",
      suggestion: "Grilled Salmon Bowl",
      macros: { protein: 35, carbs: 45, fat: 20 },
      calories: 580,
    },
  },
  {
    id: 5,
    title: "Wellbeing Score",
    description: "Holistic health monitoring",
    icon: Heart,
    color: "from-[#5C9CE6] to-[#3B82F6]",
    pillar: "wellbeing",
    mockup: {
      score: 87,
      trend: "+5",
      factors: ["Sleep: 92%", "Stress: Low", "Activity: 85%"],
    },
  },
  {
    id: 6,
    title: "Progress & Insights",
    description: "AI-powered analytics",
    icon: TrendingUp,
    color: "from-[#EC4899] to-[#DB2777]",
    pillar: "nutrition",
    mockup: {
      weeklyGoal: "5/7 days active",
      weightTrend: "-2.3 lbs this month",
      aiInsight: "Your consistency improved 40% since last month!",
    },
  },
];

// ─── Circular progress ring ─────────────────────────────────────────
function ProgressRing({ current, total }: { current: number; total: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (current + 1) / total;

  return (
    <div className="absolute -inset-6 pointer-events-none z-0 hidden sm:block">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        {/* Background ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted) / 0.15)"
          strokeWidth="2"
        />
        {/* Progress ring */}
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            rotate: "-90deg",
            transformOrigin: "center",
          }}
          strokeDasharray={circumference}
          animate={{
            strokeDashoffset: circumference * (1 - progress),
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* Dot at progress tip */}
        <motion.circle
          cx="60"
          cy="60"
          r="3"
          fill="hsl(var(--primary))"
          style={{
            offsetPath: `path('M 60 8 A 52 52 0 1 1 59.99 8')`,
          }}
          animate={{
            offsetDistance: `${progress * 100}%`,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(280, 80%, 60%)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ─── Phone mockup with 3D tilt ──────────────────────────────────────
function PhoneMockup({
  step,
  isActive,
}: {
  step: (typeof appFlowSteps)[0];
  isActive: boolean;
}) {
  const IconComponent = step.icon;
  const phoneRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-150, 150], [8, -8]), { stiffness: 200, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-150, 150], [-8, 8]), { stiffness: 200, damping: 30 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = phoneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isActive ? 1 : 0.3, scale: isActive ? 1 : 0.95 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative w-full max-w-[280px] mx-auto",
        !isActive && "pointer-events-none"
      )}
    >
      {/* Circular progress ring around phone */}
      <ProgressRing current={step.id - 1} total={appFlowSteps.length} />

      {/* 3D perspective container */}
      <motion.div
        ref={phoneRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          perspective: 800,
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Phone frame */}
        <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[2.5rem] p-2 shadow-2xl shadow-black/50">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />

          {/* Screen */}
          <div className="relative bg-background rounded-[2rem] overflow-hidden min-h-[480px]">
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-2 rounded-sm border border-current flex items-center p-0.5">
                  <div className="w-full h-full bg-green-500 rounded-sm" />
                </div>
              </div>
            </div>

            {/* App header */}
            <div className={cn("px-4 py-3 bg-gradient-to-r", step.color)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">
                    {step.title}
                  </h4>
                  <p className="text-white/70 text-xs">{step.description}</p>
                </div>
              </div>
            </div>

            {/* Dynamic content — scale + blur transitions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 1.05, filter: "blur(6px)" }}
                transition={{ duration: 0.35 }}
                className="p-4 space-y-4"
              >
                {step.id === 1 && (
                  <>
                    <div className="text-lg font-semibold">
                      {step.mockup.greeting}
                    </div>
                    <div className="glass-card rounded-xl p-3 border border-primary/20">
                      <div className="flex items-center gap-2 text-primary text-sm">
                        <Moon className="w-4 h-4" />
                        <span>{step.mockup.insight}</span>
                      </div>
                    </div>
                    <div className="bg-primary/10 rounded-xl p-3">
                      <p className="text-sm text-muted-foreground">
                        {step.mockup.suggestion}
                      </p>
                    </div>
                  </>
                )}

                {step.id === 2 && (
                  <>
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
                        <p className="text-sm">{step.mockup.userMessage}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="glass-card rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-primary" />
                          <span className="text-xs text-primary font-medium">
                            AI Coach
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {step.mockup.aiResponse}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-primary to-purple-500"
                    >
                      {step.mockup.action}
                    </Button>
                  </>
                )}

                {step.id === 3 && "progress" in step.mockup && (
                  <>
                    <div className="text-center">
                      <h4 className="font-bold text-xl">{step.mockup.workout}</h4>
                      <p className="text-sm text-muted-foreground">
                        {step.mockup.duration}
                      </p>
                    </div>
                    <div className="relative h-32 flex items-center justify-center">
                      <svg className="w-28 h-28 -rotate-90">
                        <circle
                          cx="56"
                          cy="56"
                          r="48"
                          fill="none"
                          stroke="currentColor"
                          className="text-muted/20"
                          strokeWidth="8"
                        />
                        <motion.circle
                          cx="56"
                          cy="56"
                          r="48"
                          fill="none"
                          stroke="url(#fitnessGradient)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 48}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                          animate={{
                            strokeDashoffset:
                              2 * Math.PI * 48 * (1 - (step.mockup.progress ?? 0) / 100),
                          }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                        <defs>
                          <linearGradient
                            id="fitnessGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#FF9800" />
                            <stop offset="100%" stopColor="#F57C00" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-2xl font-bold">
                          {step.mockup.progress}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass-card rounded-xl p-3 text-center">
                        <Activity className="w-5 h-5 mx-auto mb-1 text-[#FF9800]" />
                        <span className="text-xs text-muted-foreground">
                          Calories
                        </span>
                        <p className="font-semibold">{step.mockup.calories}</p>
                      </div>
                      <div className="glass-card rounded-xl p-3 text-center">
                        <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
                        <span className="text-xs text-muted-foreground">
                          Heart Rate
                        </span>
                        <p className="font-semibold">{step.mockup.heartRate}</p>
                      </div>
                    </div>
                  </>
                )}

                {step.id === 4 && "macros" in step.mockup && (
                  <>
                    <div className="glass-card rounded-xl p-4 border border-[#4CAF50]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">
                          {step.mockup.meal}
                        </span>
                        <span className="text-xs bg-[#4CAF50]/20 text-[#4CAF50] px-2 py-1 rounded-full">
                          AI Pick
                        </span>
                      </div>
                      <h4 className="font-bold text-lg">
                        {step.mockup.suggestion}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {step.mockup.calories} kcal
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Protein</span>
                        <span className="font-medium">
                          {step.mockup.macros?.protein}g
                        </span>
                      </div>
                      <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#4CAF50] to-[#388E3C]"
                          initial={{ width: 0 }}
                          animate={{ width: `${step.mockup.macros?.protein ?? 0}%` }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Carbs</span>
                        <span className="font-medium">
                          {step.mockup.macros?.carbs}g
                        </span>
                      </div>
                      <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${step.mockup.macros?.carbs ?? 0}%` }}
                          transition={{ duration: 0.5, delay: 0.4 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Fat</span>
                        <span className="font-medium">
                          {step.mockup.macros?.fat}g
                        </span>
                      </div>
                      <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-400 to-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${step.mockup.macros?.fat ?? 0}%` }}
                          transition={{ duration: 0.5, delay: 0.5 }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {step.id === 5 && "factors" in step.mockup && (
                  <>
                    <div className="text-center">
                      <div className="relative inline-block">
                        <motion.div
                          className="text-6xl font-bold gradient-text"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", duration: 0.5 }}
                        >
                          {step.mockup.score}
                        </motion.div>
                        <motion.span
                          className="absolute -top-2 -right-8 text-green-500 text-sm font-medium"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          {step.mockup.trend}
                        </motion.span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wellbeing Score
                      </p>
                    </div>
                    <div className="space-y-2">
                      {step.mockup.factors?.map((factor, i) => (
                        <motion.div
                          key={factor}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className="flex items-center gap-2 glass-card rounded-lg p-2"
                        >
                          <CheckCircle className="w-4 h-4 text-[#5C9CE6]" />
                          <span className="text-sm">{factor}</span>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}

                {step.id === 6 && (
                  <>
                    <div className="glass-card rounded-xl p-4 border border-pink-500/20">
                      <TrendingUp className="w-8 h-8 text-[#EC4899] mb-2" />
                      <p className="text-lg font-semibold">
                        {step.mockup.weeklyGoal}
                      </p>
                      <p className="text-sm text-green-500">
                        {step.mockup.weightTrend}
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-[#EC4899]/10 to-purple-500/10 rounded-xl p-4 border border-[#EC4899]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#EC4899]" />
                        <span className="text-xs text-[#EC4899] font-medium">
                          AI Insight
                        </span>
                      </div>
                      <p className="text-sm">{step.mockup.aiInsight}</p>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Glow effect */}
      <motion.div
        className={cn(
          "absolute -inset-4 rounded-[3rem] bg-gradient-to-r opacity-20 blur-2xl -z-10",
          step.color
        )}
        animate={{ opacity: isActive ? 0.3 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}

// ─── Step indicator ─────────────────────────────────────────────────
function StepIndicator({
  step,
  isActive,
  onClick,
}: {
  step: (typeof appFlowSteps)[0];
  isActive: boolean;
  onClick: () => void;
}) {
  const IconComponent = step.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all snap-center shrink-0",
        isActive ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <motion.div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
          isActive ? `bg-gradient-to-br ${step.color} shadow-lg` : "bg-muted/20"
        )}
        animate={{
          scale: isActive ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 0.5,
          repeat: isActive ? Infinity : 0,
          repeatDelay: 2,
        }}
      >
        <IconComponent
          className={cn(
            "w-5 h-5",
            isActive ? "text-white" : "text-muted-foreground"
          )}
        />
      </motion.div>
      <span
        className={cn(
          "text-xs font-medium text-center hidden sm:block",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {step.title}
      </span>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-primary"
        />
      )}
    </motion.button>
  );
}

// ─── AI APP FLOW SECTION ────────────────────────────────────────────
export function AIAppFlowSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Scroll-based zoom animation
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.88, 1, 1, 0.92]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.3, 1, 1, 0.3]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [60, 0, -60]);

  // Parallax for background glows
  const glowY1 = useTransform(scrollYProgress, [0, 1], [-50, 80]);
  const glowY2 = useTransform(scrollYProgress, [0, 1], [50, -80]);

  // Auto-advance steps
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % appFlowSteps.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle manual step selection
  const handleStepClick = (index: number) => {
    setActiveStep(index);
    setIsPlaying(false);
  };

  const resetDemo = () => {
    setActiveStep(0);
    setIsPlaying(true);
  };

  return (
    <section ref={sectionRef} className="py-20 md:py-28 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <AnimatedGradientMesh intensity={0.18} speed={0.9} blur={100} />
      <motion.div
        style={{ y: glowY1 }}
        className="absolute top-1/4 right-0 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/10 rounded-full blur-3xl"
      />
      <motion.div
        style={{ y: glowY2 }}
        className="absolute bottom-1/4 left-0 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-purple-500/10 rounded-full blur-3xl"
      />

      <motion.div
        style={{ scale, opacity, y }}
        className="container mx-auto px-4 relative z-10"
      >
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 glass-card px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6"
          >
            <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span>AI-Powered Experience</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 md:mb-6"
          >
            See{" "}
            <span className="gradient-text-animated">Balencia in Action</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm sm:text-base md:text-lg text-muted-foreground px-2 sm:px-4"
          >
            Experience how our AI seamlessly guides you through your daily
            health journey. Click any step to explore.
          </motion.p>
        </div>

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-5xl mx-auto"
        >
          {/* Step indicators - snap scroll on mobile */}
          <div className="flex items-center justify-start sm:justify-center gap-1 sm:gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {appFlowSteps.map((step, index) => (
              <StepIndicator
                key={step.id}
                step={step}
                isActive={activeStep === index}
                onClick={() => handleStepClick(index)}
              />
            ))}
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <PhoneMockup step={appFlowSteps[activeStep]} isActive={true} />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="glass border-white/10"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Play</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="glass border-white/10"
              onClick={resetDemo}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>

          {/* Step counter text */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            Step {activeStep + 1} of {appFlowSteps.length}
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
