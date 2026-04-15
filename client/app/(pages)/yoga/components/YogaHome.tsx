"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  Sparkles,
  Heart,
  Zap,
  Leaf,
  Play,
  Clock,
  Loader2,
  ArrowRight,
  ChevronRight,
  Timer,
  Youtube,
  Eye,
  Smile,
  Monitor,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionService } from "@/src/shared/services/yoga.service";
import type { YogaSession, YogaSessionType } from "@shared/types/domain/yoga";
import DemoVideoModal from "./DemoVideoModal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface YogaHomeProps {
  onStartSession: (session: YogaSession) => void;
}

interface QuickStartTemplate {
  type: YogaSessionType;
  name: string;
  description: string;
  duration: string;
  difficulty: string;
  icon: typeof Sun;
  accentColor: string;
  glowColor: string;
  iconBg: string;
  borderHover: string;
  gradientFrom: string;
  gradientTo: string;
}

/* ------------------------------------------------------------------ */
/*  Session templates with rich gradients                              */
/* ------------------------------------------------------------------ */
const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    type: "morning_flow",
    name: "Morning Flow",
    description: "Energize your body and set intentions for the day ahead",
    duration: "20 min",
    difficulty: "Beginner",
    icon: Sun,
    accentColor: "text-amber-400",
    glowColor: "shadow-amber-500/20",
    iconBg: "bg-amber-500/15",
    borderHover: "group-hover:border-amber-500/25",
    gradientFrom: "from-amber-500/10",
    gradientTo: "to-orange-500/5",
  },
  {
    type: "evening_flow",
    name: "Evening Flow",
    description: "Wind down and release the day's accumulated tension",
    duration: "25 min",
    difficulty: "Beginner",
    icon: Moon,
    accentColor: "text-indigo-400",
    glowColor: "shadow-indigo-500/20",
    iconBg: "bg-indigo-500/15",
    borderHover: "group-hover:border-indigo-500/25",
    gradientFrom: "from-indigo-500/10",
    gradientTo: "to-violet-500/5",
  },
  {
    type: "gentle_stretch",
    name: "Gentle Stretch",
    description: "Slow, mindful stretching for complete body relief",
    duration: "15 min",
    difficulty: "Beginner",
    icon: Sparkles,
    accentColor: "text-emerald-400",
    glowColor: "shadow-emerald-500/20",
    iconBg: "bg-emerald-500/15",
    borderHover: "group-hover:border-emerald-500/25",
    gradientFrom: "from-emerald-500/10",
    gradientTo: "to-teal-500/5",
  },
  {
    type: "hip_opener_flow",
    name: "Hip Opener",
    description: "Deep hip stretches to release stored emotional tension",
    duration: "30 min",
    difficulty: "Intermediate",
    icon: Heart,
    accentColor: "text-pink-400",
    glowColor: "shadow-pink-500/20",
    iconBg: "bg-pink-500/15",
    borderHover: "group-hover:border-pink-500/25",
    gradientFrom: "from-pink-500/10",
    gradientTo: "to-rose-500/5",
  },
  {
    type: "power_yoga",
    name: "Power Yoga",
    description: "Build strength and endurance with challenging flows",
    duration: "40 min",
    difficulty: "Advanced",
    icon: Zap,
    accentColor: "text-orange-400",
    glowColor: "shadow-orange-500/20",
    iconBg: "bg-orange-500/15",
    borderHover: "group-hover:border-orange-500/25",
    gradientFrom: "from-orange-500/10",
    gradientTo: "to-red-500/5",
  },
  {
    type: "recovery_flow",
    name: "Recovery",
    description: "Gentle recovery flow for rest days and sore muscles",
    duration: "20 min",
    difficulty: "Beginner",
    icon: Leaf,
    accentColor: "text-green-400",
    glowColor: "shadow-green-500/20",
    iconBg: "bg-green-500/15",
    borderHover: "group-hover:border-green-500/25",
    gradientFrom: "from-green-500/10",
    gradientTo: "to-emerald-500/5",
  },
  {
    type: "eye_exercise",
    name: "Eye Yoga",
    description: "Reduce digital strain with focused eye movements and palming techniques",
    duration: "5 min",
    difficulty: "Beginner",
    icon: Eye,
    accentColor: "text-sky-400",
    glowColor: "shadow-sky-500/20",
    iconBg: "bg-sky-500/15",
    borderHover: "group-hover:border-sky-500/25",
    gradientFrom: "from-sky-500/10",
    gradientTo: "to-blue-500/5",
  },
  {
    type: "face_yoga",
    name: "Face & Smile Yoga",
    description: "Tone facial muscles, relieve jaw tension, and boost your mood with smile exercises",
    duration: "7 min",
    difficulty: "Beginner",
    icon: Smile,
    accentColor: "text-fuchsia-400",
    glowColor: "shadow-fuchsia-500/20",
    iconBg: "bg-fuchsia-500/15",
    borderHover: "group-hover:border-fuchsia-500/25",
    gradientFrom: "from-fuchsia-500/10",
    gradientTo: "to-pink-500/5",
  },
  {
    type: "desk_stretch",
    name: "Desk Break",
    description: "Quick stretches you can do at your desk — neck, wrists, shoulders, and spine",
    duration: "5 min",
    difficulty: "Beginner",
    icon: Monitor,
    accentColor: "text-teal-400",
    glowColor: "shadow-teal-500/20",
    iconBg: "bg-teal-500/15",
    borderHover: "group-hover:border-teal-500/25",
    gradientFrom: "from-teal-500/10",
    gradientTo: "to-cyan-500/5",
  },
  {
    type: "breathwork_focus",
    name: "Breathwork Focus",
    description: "Box breathing, 4-7-8 technique, and pranayama for instant calm and mental clarity",
    duration: "8 min",
    difficulty: "Intermediate",
    icon: Wind,
    accentColor: "text-violet-400",
    glowColor: "shadow-violet-500/20",
    iconBg: "bg-violet-500/15",
    borderHover: "group-hover:border-violet-500/25",
    gradientFrom: "from-violet-500/10",
    gradientTo: "to-purple-500/5",
  },
];

const difficultyConfig: Record<
  string,
  { bg: string; text: string; dot: string; border: string }
> = {
  Beginner: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    border: "border-emerald-500/20",
  },
  Intermediate: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
    border: "border-amber-500/20",
  },
  Advanced: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400",
    border: "border-red-500/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

const smoothEase = [0.25, 0.46, 0.45, 0.94] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: smoothEase },
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.94 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: smoothEase },
  },
};

/* ------------------------------------------------------------------ */
/*  Featured hero card                                                 */
/* ------------------------------------------------------------------ */
function FeaturedCard({
  template,
  isStarting,
  onStart,
  onDemo,
}: {
  template: QuickStartTemplate;
  isStarting: boolean;
  onStart: () => void;
  onDemo: () => void;
}) {
  const Icon = template.icon;
  const diff = difficultyConfig[template.difficulty];

  return (
    <motion.div
      variants={heroVariants}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      onClick={onStart}
      className={cn(
        "group relative col-span-full cursor-pointer overflow-hidden rounded-3xl",
        "border border-white/[0.08]",
        "bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent",
        "backdrop-blur-2xl",
        "transition-all duration-700",
        "hover:border-white/[0.12] hover:shadow-2xl hover:shadow-emerald-500/[0.08]"
      )}
    >
      {/* Animated gradient mesh behind card */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className={cn(
            "absolute -top-1/2 -right-1/4 h-[200%] w-[150%] rounded-full opacity-[0.03]",
            "bg-[conic-gradient(from_0deg,transparent,theme(colors.emerald.500),transparent,theme(colors.sky.500),transparent)]"
          )}
        />
      </div>

      {/* Border gradient on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-700 group-hover:opacity-100">
        <div className="absolute inset-[-1px] rounded-3xl bg-gradient-to-br from-emerald-500/25 via-transparent to-sky-500/25" />
        <div className="absolute inset-0 rounded-3xl bg-[#0a0a0a]" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          {/* Icon block */}
          <div className="relative shrink-0">
            {/* Glow */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
              className={cn(
                "absolute inset-0 -m-4 rounded-3xl blur-2xl",
                template.iconBg
              )}
            />
            <div
              className={cn(
                "relative flex h-18 w-18 sm:h-22 sm:w-22 items-center justify-center rounded-2xl",
                "bg-gradient-to-br",
                template.gradientFrom,
                template.gradientTo,
                "border border-white/[0.06]",
                "backdrop-blur-sm",
                "transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
              )}
            >
              <Icon
                className={cn(
                  "h-8 w-8 sm:h-10 sm:w-10 transition-all duration-500",
                  template.accentColor,
                  "group-hover:drop-shadow-[0_0_12px_currentColor]"
                )}
              />
            </div>

            {/* Pulse ring */}
            <motion.div
              className={cn(
                "absolute inset-0 -m-1 rounded-2xl border-2 border-current opacity-0",
                template.accentColor
              )}
              animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400"
              >
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Featured Session
              </motion.span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border",
                  diff.bg,
                  diff.text,
                  diff.border
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", diff.dot)} />
                {template.difficulty}
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
              {template.name}
            </h3>
            <p className="text-sm sm:text-base text-zinc-400/90 max-w-lg leading-relaxed">
              {template.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-5">
              <span className="flex items-center gap-2 text-sm text-zinc-500">
                <Timer className="h-4 w-4" />
                {template.duration}
              </span>

              <motion.button
                disabled={isStarting}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold",
                  "bg-gradient-to-r from-emerald-600 to-sky-600 text-white",
                  "shadow-lg shadow-emerald-500/20",
                  "hover:from-emerald-500 hover:to-sky-500 hover:shadow-xl hover:shadow-emerald-500/30",
                  "transition-all duration-300",
                  isStarting && "opacity-60 cursor-not-allowed"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onStart();
                }}
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isStarting ? "Loading..." : "Start Session"}
                {!isStarting && <ArrowRight className="h-4 w-4" />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium",
                  "bg-red-500/10 text-red-400 border border-red-500/20",
                  "hover:bg-red-500/15 hover:border-red-500/30",
                  "transition-all duration-300"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDemo();
                }}
              >
                <Youtube className="h-4 w-4" />
                Watch Demo
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Session card with hover reveal                                     */
/* ------------------------------------------------------------------ */
function SessionCard({
  template,
  isStarting,
  onStart,
  onDemo,
}: {
  template: QuickStartTemplate;
  isStarting: boolean;
  onStart: () => void;
  onDemo: () => void;
}) {
  const Icon = template.icon;
  const diff = difficultyConfig[template.difficulty];

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onStart}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl",
        "border border-white/[0.06]",
        "bg-gradient-to-b from-white/[0.04] to-transparent",
        "backdrop-blur-2xl",
        "transition-all duration-500",
        "hover:border-white/[0.12]",
        "hover:shadow-xl",
        template.glowColor,
        template.borderHover
      )}
    >
      {/* Background gradient on hover */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
          "bg-gradient-to-br",
          template.gradientFrom,
          template.gradientTo
        )}
      />

      {/* Shimmer sweep */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        initial={false}
      >
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 3,
            ease: "easeInOut",
          }}
          className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        />
      </motion.div>

      <div className="relative z-10 p-5 sm:p-6">
        {/* Icon + difficulty row */}
        <div className="flex items-start justify-between mb-5">
          <div
            className={cn(
              "flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl",
              "bg-gradient-to-br",
              template.gradientFrom,
              template.gradientTo,
              "border border-white/[0.06]",
              "backdrop-blur-sm",
              "transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
              "group-hover:shadow-lg",
              template.glowColor
            )}
          >
            <Icon
              className={cn(
                "h-6 w-6 sm:h-7 sm:w-7 transition-all duration-500",
                template.accentColor,
                "group-hover:drop-shadow-[0_0_8px_currentColor]"
              )}
            />
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border",
              diff.bg,
              diff.text,
              diff.border
            )}
          >
            <span className={cn("h-1 w-1 rounded-full", diff.dot)} />
            {template.difficulty}
          </span>
        </div>

        {/* Title + description */}
        <div className="mb-5">
          <h3 className="font-bold text-[15px] text-white mb-1.5 group-hover:text-white transition-colors">
            {template.name}
          </h3>
          <p className="text-[13px] text-zinc-500 line-clamp-2 leading-relaxed group-hover:text-zinc-400 transition-colors">
            {template.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" />
            {template.duration}
          </span>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-medium text-red-400/70 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
              onClick={(e) => {
                e.stopPropagation();
                onDemo();
              }}
            >
              <Youtube className="h-3 w-3" />
              Demo
            </motion.button>

            <motion.div
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold",
                "bg-white/[0.06] text-white/80",
                "border border-white/[0.04]",
                "group-hover:bg-white/[0.1] group-hover:text-white group-hover:border-white/[0.08]",
                "transition-all duration-300",
                isStarting && "opacity-60 cursor-not-allowed"
              )}
            >
              {isStarting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isStarting ? "Loading" : "Start"}
              {!isStarting && (
                <ChevronRight className="h-3 w-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback phase builder for sessions without DB templates           */
/* ------------------------------------------------------------------ */
function buildFallbackPhases(type: string, durationMins: number) {
  const totalSec = durationMins * 60;

  const SHORT_SESSIONS: Record<string, { phases: { phaseType: string; name: string; pct: number; breathing: string; script?: string }[] }> = {
    eye_exercise: {
      phases: [
        { phaseType: "warmup", name: "Eye Palming", pct: 0.2, breathing: "natural", script: "Rub your palms together until warm, then gently cup them over your closed eyes. Breathe deeply and let the warmth relax your eye muscles." },
        { phaseType: "flow", name: "Eye Circles", pct: 0.2, breathing: "natural", script: "Look up, slowly circle your eyes clockwise. Make 5 full circles, then reverse counter-clockwise for 5 more. Keep your head still." },
        { phaseType: "flow", name: "Focus Shifting", pct: 0.2, breathing: "natural", script: "Hold a thumb 10 inches away. Focus on it for 5 seconds, then shift focus to something 20 feet away for 5 seconds. Repeat." },
        { phaseType: "flow", name: "Figure 8 Tracking", pct: 0.2, breathing: "natural", script: "Imagine a large figure 8 on the wall. Trace it with your eyes slowly. After 30 seconds, reverse direction." },
        { phaseType: "cooldown", name: "Eye Palming Rest", pct: 0.2, breathing: "natural", script: "Return to palming. Close your eyes, breathe deeply, and feel the tension release from around your eyes." },
      ],
    },
    face_yoga: {
      phases: [
        { phaseType: "warmup", name: "Jaw Release", pct: 0.15, breathing: "natural", script: "Drop your jaw wide open, then close slowly. Repeat 10 times. Massage your jaw joints in small circles." },
        { phaseType: "flow", name: "Lion's Breath", pct: 0.2, breathing: "natural", script: "Inhale deeply through your nose, then exhale forcefully with tongue out, eyes wide, fingers spread. Release all facial tension. Repeat 5 times." },
        { phaseType: "flow", name: "Cheek Lifts", pct: 0.2, breathing: "natural", script: "Smile as wide as you can, pressing fingertips into your cheeks. Lift your cheeks toward your eyes. Hold 5 seconds, repeat 10 times." },
        { phaseType: "flow", name: "Forehead Smoother", pct: 0.2, breathing: "natural", script: "Place both palms on your forehead. Sweep outward while applying gentle pressure. Smooths forehead lines and releases tension." },
        { phaseType: "cooldown", name: "Gratitude Smile", pct: 0.25, breathing: "natural", script: "Close your eyes and smile gently. Think of something you're grateful for. Hold this genuine smile for 30 seconds — it releases endorphins." },
      ],
    },
    desk_stretch: {
      phases: [
        { phaseType: "warmup", name: "Neck Rolls", pct: 0.2, breathing: "natural", script: "Drop your chin to your chest. Slowly roll your head to the right, back, left, and forward. 5 circles each direction." },
        { phaseType: "flow", name: "Shoulder Shrugs & Rolls", pct: 0.2, breathing: "natural", script: "Shrug both shoulders up to your ears, hold 3 seconds, drop. Then roll shoulders forward 5 times, backward 5 times." },
        { phaseType: "flow", name: "Seated Spinal Twist", pct: 0.2, breathing: "ujjayi", script: "Sit tall. Place right hand on left knee, twist gently left. Hold 20 seconds. Switch sides. Breathe into each twist." },
        { phaseType: "flow", name: "Wrist & Finger Stretch", pct: 0.2, breathing: "natural", script: "Extend one arm, pull fingers back with other hand. Hold 15 seconds each side. Then make fists, open wide, repeat 10 times." },
        { phaseType: "cooldown", name: "Chest Opener", pct: 0.2, breathing: "natural", script: "Clasp hands behind your back, straighten arms, lift hands slightly while opening your chest. Hold 20 seconds. Release." },
      ],
    },
    breathwork_focus: {
      phases: [
        { phaseType: "warmup", name: "Natural Awareness", pct: 0.12, breathing: "natural", script: "Close your eyes. Simply observe your breath without changing it. Notice the rhythm, depth, and temperature of each breath." },
        { phaseType: "breathwork", name: "Box Breathing", pct: 0.25, breathing: "box", script: "Inhale for 4 counts. Hold for 4 counts. Exhale for 4 counts. Hold empty for 4 counts. Repeat this cycle. Used by Navy SEALs for instant calm." },
        { phaseType: "breathwork", name: "4-7-8 Technique", pct: 0.25, breathing: "natural", script: "Inhale through your nose for 4 counts. Hold for 7 counts. Exhale slowly through your mouth for 8 counts. This activates your parasympathetic nervous system." },
        { phaseType: "breathwork", name: "Alternate Nostril", pct: 0.25, breathing: "alternate_nostril", script: "Close right nostril with your thumb, inhale left. Close left with ring finger, exhale right. Inhale right, close, exhale left. One full cycle." },
        { phaseType: "cooldown", name: "Integration", pct: 0.13, breathing: "natural", script: "Return to natural breathing. Notice how your body feels — calmer, lighter, more focused. Carry this awareness with you." },
      ],
    },
  };

  const config = SHORT_SESSIONS[type];
  if (config) {
    return config.phases.map((p) => ({
      phaseType: p.phaseType as any,
      name: p.name,
      durationSeconds: Math.round(totalSec * p.pct),
      poses: [],
      breathingPattern: p.breathing as any,
      narrationScript: p.script,
    }));
  }

  // Default fallback for standard yoga sessions
  return [
    { phaseType: "warmup" as const, name: "Centering Breath", durationSeconds: 120, poses: [], breathingPattern: "natural" as const },
    { phaseType: "flow" as const, name: "Main Flow", durationSeconds: totalSec - 240, poses: [], breathingPattern: "ujjayi" as const },
    { phaseType: "savasana" as const, name: "Final Rest", durationSeconds: 120, poses: [], breathingPattern: "natural" as const },
  ];
}

/* ------------------------------------------------------------------ */
/*  Section heading                                                    */
/* ------------------------------------------------------------------ */
function SectionHeading() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-end justify-between"
    >
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
          Quick Start
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Choose a session and begin your practice
        </p>
      </div>
      <span className="text-[11px] font-medium text-zinc-600 tabular-nums">
        {QUICK_START_TEMPLATES.length} sessions
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center gap-3 py-10"
    >
      <div className="relative">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <div className="absolute inset-0 h-5 w-5 animate-ping rounded-full bg-emerald-400/20" />
      </div>
      <span className="text-sm text-zinc-500">Loading templates...</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function YogaHome({ onStartSession }: YogaHomeProps) {
  const [templates, setTemplates] = useState<YogaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingType, setStartingType] = useState<YogaSessionType | null>(
    null
  );
  const [demoSession, setDemoSession] = useState<QuickStartTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchTemplates() {
      try {
        const res = await sessionService.getTemplates();
        if (!cancelled && res.data?.sessions) {
          setTemplates(res.data.sessions);
        }
      } catch {
        // Silently fail - we have fallback UI
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async (template: QuickStartTemplate) => {
    setStartingType(template.type);
    try {
      const match = templates.find(
        (t) => t.sessionType === template.type && t.isTemplate
      );
      if (match) {
        onStartSession(match);
      } else {
        const durationMins = parseInt(template.duration);
        const phases = buildFallbackPhases(template.type, durationMins);
        const themeMap: Record<string, string> = {
          eye_exercise: "ocean",
          face_yoga: "sunrise",
          desk_stretch: "mountain",
          breathwork_focus: "night",
        };
        const fallbackSession: YogaSession = {
          id: `local-${template.type}`,
          title: template.name,
          description: template.description,
          sessionType: template.type,
          difficulty:
            template.difficulty.toLowerCase() as YogaSession["difficulty"],
          durationMinutes: durationMins,
          isTemplate: true,
          isAiGenerated: false,
          phases,
          ambientTheme: (themeMap[template.type] || "forest") as YogaSession["ambientTheme"],
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onStartSession(fallbackSession);
      }
    } finally {
      setStartingType(null);
    }
  };

  const [featured, ...rest] = QUICK_START_TEMPLATES;

  return (
    <div className="space-y-8">
      <SectionHeading />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
      >
        <FeaturedCard
          template={featured}
          isStarting={startingType === featured.type}
          onStart={() => handleStart(featured)}
          onDemo={() => setDemoSession(featured)}
        />

        {rest.map((template) => (
          <SessionCard
            key={template.type}
            template={template}
            isStarting={startingType === template.type}
            onStart={() => handleStart(template)}
            onDemo={() => setDemoSession(template)}
          />
        ))}
      </motion.div>

      <AnimatePresence>{loading && <LoadingSkeleton />}</AnimatePresence>

      <DemoVideoModal
        isOpen={!!demoSession}
        onClose={() => setDemoSession(null)}
        sessionName={demoSession?.name || ""}
        accentColor={demoSession?.accentColor || "text-emerald-400"}
      />
    </div>
  );
}
