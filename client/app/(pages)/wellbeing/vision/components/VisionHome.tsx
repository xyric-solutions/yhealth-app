"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, Zap, Clock, Play, ArrowRight, Sparkles, Target, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import ColorTestPlayer from "./ColorTestPlayer";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

type TestMode = "color_vision_quick" | "color_vision_advanced";

interface TestTypeCard {
  mode: TestMode;
  title: string;
  description: string;
  plates: number;
  duration: string;
  features: string[];
  icon: typeof Eye;
  accent: string;
  gradient: string;
  glow: string;
}

const TEST_TYPES: TestTypeCard[] = [
  {
    mode: "color_vision_quick",
    title: "Quick Color Test",
    description: "10 rapid color plates to screen your color vision in under 2 minutes",
    plates: 10,
    duration: "~2 min",
    features: ["10 Ishihara-style plates", "MCQ answers", "Instant results"],
    icon: Zap,
    accent: "text-amber-400",
    gradient: "from-amber-500/10 to-orange-500/5",
    glow: "shadow-amber-500/20",
  },
  {
    mode: "color_vision_advanced",
    title: "Advanced Diagnostic",
    description: "Adaptive 15-plate test that adjusts difficulty based on your responses",
    plates: 15,
    duration: "~4 min",
    features: ["Adaptive difficulty", "Detailed classification", "Confidence scoring"],
    icon: Target,
    accent: "text-violet-400",
    gradient: "from-violet-500/10 to-indigo-500/5",
    glow: "shadow-violet-500/20",
  },
];

export default function VisionHome() {
  const [activeTest, setActiveTest] = useState<TestMode | null>(null);

  if (activeTest) {
    return (
      <ColorTestPlayer
        testType={activeTest}
        onClose={() => setActiveTest(null)}
      />
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Info Banner */}
      <motion.div
        variants={cardVariants}
        className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
          <Shield className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">How it works</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Each plate displays a pattern of colored dots with a hidden number.
            Select the correct number from 4 options before time runs out.
            Results indicate your color vision type with confidence scoring.
          </p>
        </div>
      </motion.div>

      {/* Test Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {TEST_TYPES.map((test) => {
          const Icon = test.icon;
          return (
            <motion.div
              key={test.mode}
              variants={cardVariants}
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTest(test.mode)}
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-2xl",
                "border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent",
                "backdrop-blur-2xl transition-all duration-500",
                "hover:border-white/[0.12] hover:shadow-xl",
                test.glow
              )}
            >
              {/* Hover gradient */}
              <div className={cn(
                "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                "bg-gradient-to-br", test.gradient
              )} />

              <div className="relative z-10 p-6">
                {/* Icon + Badge */}
                <div className="flex items-start justify-between mb-5">
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-xl",
                    "bg-gradient-to-br", test.gradient,
                    "border border-white/[0.06] transition-transform duration-500",
                    "group-hover:scale-110 group-hover:rotate-3"
                  )}>
                    <Icon className={cn("h-7 w-7", test.accent)} />
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                    <Clock className="h-3.5 w-3.5" />
                    {test.duration}
                  </span>
                </div>

                {/* Title + Description */}
                <h3 className="text-lg font-bold text-white mb-2">{test.title}</h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
                  {test.description}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {test.features.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] text-zinc-400"
                    >
                      <Sparkles className="h-3 w-3" />
                      {f}
                    </span>
                  ))}
                </div>

                {/* Start Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold",
                    "bg-gradient-to-r from-emerald-600 to-sky-600 text-white",
                    "shadow-lg shadow-emerald-500/15",
                    "hover:from-emerald-500 hover:to-sky-500",
                    "transition-all duration-300"
                  )}
                >
                  <Play className="h-4 w-4" />
                  Start {test.plates}-Plate Test
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
