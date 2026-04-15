"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Clock,
  Check,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Star,
  Brain,
} from "lucide-react";
import { useOnboarding } from "@/src/features/onboarding/context/OnboardingContext";
import type { AssessmentMode } from "@/src/types";

interface ModeOption {
  id: AssessmentMode;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  duration: string;
  features: string[];
  recommended?: boolean;
}

const modeOptions: ModeOption[] = [
  {
    id: "deep",
    icon: <Brain className="w-7 h-7" />,
    title: "Deep Assessment",
    subtitle: "Comprehensive analysis for maximum personalization",
    duration: "10-15 Minutes",
    features: [
      "Conversational AI coaching",
      "In-depth lifestyle analysis",
      "Detailed Personalized insights",
      "Premium action plan",
    ],
    recommended: true,
  },
  {
    id: "quick",
    icon: <Zap className="w-7 h-7" />,
    title: "Quick Assessment",
    subtitle: "Get started fast with essential questions",
    duration: "3-5 Minutes",
    features: [
      "6-8 targeted questions",
      "Core health insights",
      "Instant plan generation",
      "Prefect for busy schedules",
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

export function AssessmentModeStep() {
  const { assessmentMode, setAssessmentMode, nextStep, prevStep, selectedGoal } =
    useOnboarding();

  const getGoalTitle = () => {
    const goalTitles: Record<string, string> = {
      weight_loss: "losing weight",
      muscle_building: "building muscle",
      sleep_improvement: "better sleep",
      stress_wellness: "stress management",
      energy_productivity: "boosting energy",
      event_training: "event training",
      health_condition: "health management",
      habit_building: "habit building",
      overall_optimization: "health optimization",
      custom: "your custom goal",
    };
    return goalTitles[selectedGoal || ""] || "your health journey";
  };

  const canContinue = assessmentMode !== null;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-10">
      {/* Header */}
      <motion.div
        className="text-center mb-8 md:mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sky-600 mb-5"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-xs font-medium bg-gradient-to-r from-purple-300 via-violet-300 to-blue-300 bg-clip-text text-transparent">
            Choose your assessment style
          </span>
        </motion.div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mb-3">
          How Would You Like to Proceed?
        </h1>
        <p className="text-[rgba(239,237,253,0.7)] text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
          Choose how you&apos;d like us to learn about you for {getGoalTitle()}.
          Either option creates a personalized plan tailored to your needs.
        </p>
      </motion.div>

      {/* Mode Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {modeOptions.map((mode) => {
          const isSelected = assessmentMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              variants={cardVariants}
              onClick={() => setAssessmentMode(mode.id)}
              className={`
                group relative p-5 sm:p-7 rounded-2xl text-left transition-all duration-300
                border overflow-hidden
                ${
                  isSelected
                    ? "border-emerald-600 border-[1.5px]"
                    : "bg-[#02000f] border-white/[0.24] hover:border-white/40"
                }
              `}
              style={
                isSelected
                  ? { backgroundImage: "linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)" }
                  : undefined
              }
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Recommended Badge */}
              {mode.recommended && (
                <motion.div
                  className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-xs font-semibold text-white"
                  initial={{ opacity: 0, scale: 0, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                >
                  <Star className="w-3 h-3" />
                  Recommended
                </motion.div>
              )}

              {/* Selection Radio */}
              <div className="absolute top-4 right-4">
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSelected ? "border-emerald-500 bg-emerald-600" : "border-white/30"}
                `}>
                  {isSelected && (
                    <motion.div
                      className="w-3 h-3 rounded-full bg-white"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="mt-8 sm:mt-10">
                {/* Icon */}
                <div className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center mb-5
                  ${isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/70"}
                `}>
                  {mode.icon}
                </div>

                <h3 className="text-xl sm:text-2xl font-medium text-white mb-2">
                  {mode.title}
                </h3>
                <p className="text-[rgba(239,237,253,0.7)] mb-4 text-sm sm:text-base">
                  {mode.subtitle}
                </p>

                {/* Duration Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 mb-5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">
                    {mode.duration}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {mode.features.map((feature, i) => (
                    <motion.li
                      key={i}
                      className="flex items-start gap-3 text-sm sm:text-base"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                    >
                      <div className={`
                        w-5 h-5 rounded-full flex items-center justify-center mt-0.5
                        ${isSelected ? "bg-emerald-500/20" : "bg-white/10"}
                      `}>
                        <Check className={`w-3 h-3 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} strokeWidth={3} />
                      </div>
                      <span className={isSelected ? "text-slate-200" : "text-slate-400"}>
                        {feature}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Pro Tip */}
      <motion.div
        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-slate-800/40 border border-slate-700/40 mb-6 sm:mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <p className="text-sm sm:text-base text-[rgba(239,237,253,0.8)]">
          <span className="font-semibold text-emerald-500">Pro tip:</span>{" "}
          You can switch modes anytime. Start with Quick and upgrade to Deep later for more personalization.
        </p>
      </motion.div>

      {/* Navigation */}
      <div className="flex flex-col gap-4">
        {/* CTA — full width sky-600 */}
        <motion.button
          onClick={nextStep}
          disabled={!canContinue}
          className={`
            w-full flex items-center justify-center gap-2
            px-6 py-3 sm:py-3.5 rounded-xl font-medium text-base sm:text-lg
            transition-all duration-300 border border-white/20
            ${
              canContinue
                ? "bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-600/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700"
            }
          `}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={canContinue ? { scale: 1.01 } : {}}
          whileTap={canContinue ? { scale: 0.99 } : {}}
        >
          <span>
            {assessmentMode === "quick"
              ? "Start Quick Assessment"
              : assessmentMode === "deep"
                ? "Start Deep Assessment"
                : "Continue"}
          </span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* Back */}
        <motion.button
          onClick={prevStep}
          className="flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-white transition-colors group"
          whileHover={{ x: -4 }}
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </motion.button>
      </div>
    </div>
  );
}
