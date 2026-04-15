"use client";

import { motion } from "framer-motion";
import { InsightCard } from "./cards/InsightCard";
import { Wind, Smile, BookOpen, type LucideIcon } from "lucide-react";

interface AIInsight {
  text: string;
  actions: Array<{ label: string; href: string; icon: LucideIcon }>;
  explanation?: string;
}

interface WellbeingInsightsProps {
  insight?: AIInsight;
  isLoading?: boolean;
}

// Placeholder insight generator
export function generatePlaceholderInsight(): AIInsight {
  return {
    text: "Your stress is 14% above weekly average. Try a 5-minute breathing exercise to help manage it.",
    actions: [
      { label: "Start Breathing", href: "/wellbeing/breathing", icon: Wind },
      { label: "Log Mood", href: "/wellbeing/mood", icon: Smile },
      { label: "Quick Journal", href: "/wellbeing/journal", icon: BookOpen },
    ],
    explanation:
      "Based on your recent stress logs and patterns, we've detected elevated stress levels. Breathing exercises have been shown to reduce stress by activating the parasympathetic nervous system. Regular mood logging helps track patterns and identify triggers.",
  };
}

export function WellbeingInsights({
  insight,
  isLoading = false,
}: WellbeingInsightsProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="h-48 w-full animate-pulse rounded-xl bg-slate-800/60" />
      </motion.div>
    );
  }

  const displayInsight = insight || generatePlaceholderInsight();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      <InsightCard
        text={displayInsight.text}
        actions={displayInsight.actions}
        explanation={displayInsight.explanation}
      />
    </motion.div>
  );
}

