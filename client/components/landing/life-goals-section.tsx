"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Target,
  Sparkles,
  Trophy,
  Briefcase,
  Moon,
  Dumbbell,
  Calendar,
  Utensils,
  Heart,
  Users,
  DollarSign,
  TrendingUp,
  Zap,
  ArrowRight,
  Brain,
  Shield,
  Flame,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { AnimatedGradientMesh, GSAPScrollReveal } from "./shared";

// ─── Goal Data ───────────────────────────────────────────────────────

const goals = [
  {
    id: "marathon",
    icon: Dumbbell,
    label: "Run a marathon",
    subtitle: "26.2 miles in 16 weeks",
    gradient: "from-cyan-400 to-teal-500",
    glowColor: "rgba(34, 211, 238, 0.4)",
    accentColor: "#22d3ee",
    stats: { actions: 4, milestones: 12, dailyTasks: 6 },
    breakdown: [
      { icon: Calendar, title: "16-week progressive training", pillar: "Fitness", frequency: "5x / week", progress: 0.78, desc: "Periodized plan from 5K to full marathon distance" },
      { icon: Utensils, title: "Carb-loading & hydration plan", pillar: "Nutrition", frequency: "Daily", progress: 0.65, desc: "Race-day fueling strategy with macro targets" },
      { icon: Moon, title: "Recovery & sleep optimization", pillar: "Wellbeing", frequency: "Nightly", progress: 0.82, desc: "8hr sleep protocol with HRV-based rest days" },
      { icon: TrendingUp, title: "Pace & distance milestones", pillar: "Tracking", frequency: "Weekly", progress: 0.54, desc: "GPS-tracked runs with progressive pace targets" },
    ],
  },
  {
    id: "business",
    icon: Briefcase,
    label: "Start a business",
    subtitle: "From idea to revenue in 90 days",
    gradient: "from-purple-400 to-violet-500",
    glowColor: "rgba(167, 139, 250, 0.4)",
    accentColor: "#a78bfa",
    stats: { actions: 4, milestones: 8, dailyTasks: 5 },
    breakdown: [
      { icon: Target, title: "Daily focus & priority system", pillar: "Productivity", frequency: "Daily", progress: 0.71, desc: "Top-3 daily tasks aligned to launch milestones" },
      { icon: Brain, title: "Skill-building curriculum", pillar: "Education", frequency: "3x / week", progress: 0.45, desc: "Targeted learning for your business model" },
      { icon: DollarSign, title: "Financial milestones & budgeting", pillar: "Finances", frequency: "Monthly", progress: 0.33, desc: "Revenue projections, burn rate, break-even targets" },
      { icon: Users, title: "Networking & mentor outreach", pillar: "Relationships", frequency: "Weekly", progress: 0.58, desc: "Strategic connections mapped to growth phases" },
    ],
  },
  {
    id: "faith",
    icon: Moon,
    label: "Deepen my faith",
    subtitle: "Consistent spiritual practice",
    gradient: "from-emerald-400 to-green-500",
    glowColor: "rgba(52, 211, 153, 0.4)",
    accentColor: "#34d399",
    stats: { actions: 4, milestones: 6, dailyTasks: 7 },
    breakdown: [
      { icon: Clock, title: "Daily prayer & mindfulness", pillar: "Spirituality", frequency: "5x / day", progress: 0.88, desc: "Scheduled reminders with reflection prompts" },
      { icon: Shield, title: "Scripture study tracker", pillar: "Education", frequency: "Daily", progress: 0.62, desc: "Progressive reading plan with comprehension notes" },
      { icon: Heart, title: "Gratitude & reflection journal", pillar: "Wellbeing", frequency: "Evening", progress: 0.74, desc: "Evening reflections linked to daily intentions" },
      { icon: Users, title: "Community service goals", pillar: "Relationships", frequency: "Weekly", progress: 0.41, desc: "Volunteer hours and acts of kindness tracking" },
    ],
  },
  {
    id: "promoted",
    icon: Trophy,
    label: "Get promoted",
    subtitle: "Next level in 6 months",
    gradient: "from-amber-400 to-orange-500",
    glowColor: "rgba(251, 146, 60, 0.4)",
    accentColor: "#fb923c",
    stats: { actions: 4, milestones: 10, dailyTasks: 4 },
    breakdown: [
      { icon: BarChart3, title: "Skill gap analysis & courses", pillar: "Career", frequency: "Ongoing", progress: 0.67, desc: "Competency map with targeted upskilling path" },
      { icon: Users, title: "Strategic visibility & networking", pillar: "Relationships", frequency: "Weekly", progress: 0.52, desc: "Stakeholder mapping and influence strategy" },
      { icon: Flame, title: "High-impact project delivery", pillar: "Productivity", frequency: "Sprint-based", progress: 0.39, desc: "Visible wins aligned to promotion criteria" },
      { icon: Heart, title: "Stress management & balance", pillar: "Wellbeing", frequency: "Daily", progress: 0.73, desc: "Burnout prevention with energy management" },
    ],
  },
];

// Typewriter phrases
const typewriterPhrases = [
  "AI breaks it down",
  "AI builds your plan",
  "AI tracks your progress",
  "AI adapts in real-time",
];

// ─── Animated typing component ────────────────────────────────────────
function TypewriterText() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const phrase = typewriterPhrases[phraseIndex];
    const speed = isDeleting ? 30 : 60;

    if (!isDeleting && charIndex === phrase.length) {
      const pause = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(pause);
    }
    if (isDeleting && charIndex === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- typewriter state machine transition
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % typewriterPhrases.length);
      return;
    }

    const timer = setTimeout(() => {
      setCharIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, phraseIndex]);

  const currentText = typewriterPhrases[phraseIndex].substring(0, charIndex);

  return (
    <span className="relative">
      <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
        {currentText}
      </span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        className="inline-block w-[3px] h-[0.85em] bg-gradient-to-b from-cyan-400 to-purple-400 ml-0.5 align-middle rounded-full"
      />
    </span>
  );
}

// ─── Animated progress bar ─────────────────────────────────────────────
function AnimatedProgress({ value, color, delay }: { value: number; color: string; delay: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 1.2, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

// ─── LIFE GOALS SECTION ──────────────────────────────────────────────
export function LifeGoalsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeGoal, setActiveGoal] = useState(goals[0].id);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const active = goals.find((g) => g.id === activeGoal) ?? goals[0];

  // Mouse tracking for background glow
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const glowX = useTransform(mouseX, [0, 1], ["0%", "100%"]);
  const glowY = useTransform(mouseY, [0, 1], ["0%", "100%"]);

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

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <AnimatedGradientMesh intensity={0.12} blur={100} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
        {/* Mouse-following glow */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 pointer-events-none"
          style={{
            left: glowX,
            top: glowY,
            background: `radial-gradient(circle, ${active.glowColor}, transparent 70%)`,
            x: "-50%",
            y: "-50%",
          }}
        />
        {/* Floating orbs */}
        <motion.div
          animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-cyan-400/30"
        />
        <motion.div
          animate={{ y: [15, -15, 15], x: [8, -8, 8] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 right-[20%] w-1.5 h-1.5 rounded-full bg-purple-400/30"
        />
        <motion.div
          animate={{ y: [-12, 18, -12] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/3 left-[25%] w-1 h-1 rounded-full bg-amber-400/40"
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <GSAPScrollReveal
          direction="up"
          distance={30}
          duration={0.7}
          className="text-center max-w-4xl mx-auto mb-16 md:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs sm:text-sm font-medium text-white/70 mb-8 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Goal Intelligence Engine
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.08]">
            Dream big.{" "}
            <br className="hidden sm:block" />
            <TypewriterText />
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground/70 max-w-2xl mx-auto leading-relaxed">
            Tell us your life ambition. Our AI instantly decomposes it into a
            personalized, multi-domain action plan — then adapts as you progress.
          </p>
        </GSAPScrollReveal>

        {/* Interactive Goal Experience */}
        <div className="max-w-8xl mx-auto">
          {/* Goal selector — horizontal scroll on mobile, grid on desktop */}
          <GSAPScrollReveal direction="up" distance={20} duration={0.6}>
            <div className="flex gap-3 sm:gap-4 mb-8 md:mb-12 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
              {goals.map((goal, i) => {
                const Icon = goal.icon;
                const isActive = goal.id === activeGoal;
                return (
                  <motion.button
                    key={goal.id}
                    onClick={() => setActiveGoal(goal.id)}
                    className={cn(
                      "group relative rounded-2xl border p-5 sm:p-6 text-left transition-all duration-300 cursor-pointer min-w-[180px] md:min-w-0 shrink-0 md:shrink",
                      isActive
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-white/[0.06] bg-white/[0.015] hover:border-white/12 hover:bg-white/[0.03]"
                    )}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{
                          background: `radial-gradient(ellipse at top, ${goal.glowColor}40, transparent 70%)`,
                        }}
                        layoutId="goalHighlight"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    {/* Top gradient bar */}
                    <div
                      className={cn(
                        "absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r transition-opacity duration-300",
                        goal.gradient,
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                      )}
                    />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={cn(
                            "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                            goal.gradient
                          )}
                        >
                          <Icon className="w-5.5 h-5.5 text-white" />
                        </div>
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
                          >
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          </motion.div>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm font-bold transition-colors mb-1",
                        isActive ? "text-foreground" : "text-muted-foreground/80"
                      )}>
                        {goal.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/40 font-medium">
                        {goal.subtitle}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </GSAPScrollReveal>

          {/* Breakdown panel — premium glass card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGoal}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-md overflow-hidden"
            >
              {/* Animated top glow */}
              <div
                className="absolute -top-1 left-0 right-0 h-[1px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${active.accentColor}80, transparent)`,
                }}
              />
              <motion.div
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-[100px] opacity-25"
                style={{
                  background: `radial-gradient(circle, ${active.glowColor}, transparent 70%)`,
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.3, 0.2] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative p-6 sm:p-8 lg:p-10">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-8 sm:mb-10">
                  <div className="flex items-center gap-4">
                    <motion.div
                      className={cn(
                        "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl",
                        active.gradient
                      )}
                      animate={{ rotate: [0, 3, -3, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <active.icon className="w-7 h-7 text-white" />
                    </motion.div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground/50 font-semibold uppercase tracking-[0.15em] mb-1">
                        AI-Generated Game Plan
                      </p>
                      <h3 className="text-2xl sm:text-3xl font-bold text-foreground/95 tracking-tight">
                        {active.label}
                      </h3>
                    </div>
                  </div>

                  {/* Stats badges */}
                  <div className="flex flex-wrap gap-2 sm:ml-auto">
                    {[
                      { label: "Action Areas", value: active.stats.actions, icon: Zap },
                      { label: "Milestones", value: active.stats.milestones, icon: Target },
                      { label: "Daily Tasks", value: active.stats.dailyTasks, icon: Flame },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]"
                      >
                        <stat.icon className="w-3 h-3" style={{ color: active.accentColor }} />
                        <span className="text-xs font-bold text-white/90">{stat.value}</span>
                        <span className="text-[10px] text-white/40 hidden sm:inline">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Breakdown grid */}
                <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                  {active.breakdown.map((item, i) => {
                    const ItemIcon = item.icon;
                    return (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 + 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="group/item relative rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-300 p-5 overflow-hidden"
                      >
                        {/* Hover glow */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{
                            background: `radial-gradient(ellipse at top left, ${active.glowColor}15, transparent 60%)`,
                          }}
                        />

                        <div className="relative">
                          <div className="flex items-start gap-4 mb-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md transition-transform duration-300 group-hover/item:scale-110",
                                active.gradient
                              )}
                            >
                              <ItemIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground/90 mb-0.5 leading-snug">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground/40 leading-relaxed line-clamp-2">
                                {item.desc}
                              </p>
                            </div>
                          </div>

                          {/* Progress + meta */}
                          <div className="flex items-center gap-3 mt-4">
                            <div className="flex-1">
                              <AnimatedProgress
                                value={item.progress}
                                color={active.accentColor}
                                delay={i * 0.1 + 0.4}
                              />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: active.accentColor }}>
                              {Math.round(item.progress * 100)}%
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.03]" style={{ color: active.accentColor }}>
                              {item.pillar}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {item.frequency}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* CTA row */}
                <motion.div
                  className="flex flex-col sm:flex-row items-center justify-between mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/[0.06]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <p className="text-sm text-muted-foreground/50 mb-4 sm:mb-0">
                    <span className="text-foreground/70 font-semibold">100% personalized</span>{" "}
                    — AI adapts this plan to your schedule, fitness level, and preferences.
                  </p>
                  <motion.button
                    className={cn(
                      "group flex items-center gap-2.5 px-6 py-3 rounded-full font-semibold text-sm text-white shadow-xl transition-all duration-300 bg-gradient-to-r",
                      active.gradient
                    )}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Create My Plan
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
