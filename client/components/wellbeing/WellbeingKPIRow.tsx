"use client";

import { motion } from "framer-motion";
import { StatCard } from "./cards/StatCard";
import { SkeletonCard } from "./cards/SkeletonCard";
import { Heart, Smile, Zap, Activity } from "lucide-react";

export interface WellbeingKPIs {
  overallScore: number; // 0-100
  overallDelta: number; // vs yesterday
  moodScore: number;
  moodTrend: "up" | "down" | "stable";
  energyScore: number;
  energyTrend: "up" | "down" | "stable";
  stressScore: number;
  stressTrend: "up" | "down" | "stable";
}

interface WellbeingKPIRowProps {
  kpis?: WellbeingKPIs;
  isLoading?: boolean;
}

// Placeholder data generator
export function generatePlaceholderKPIs(): WellbeingKPIs {
  return {
    overallScore: Math.floor(Math.random() * 30) + 65, // 65-95
    overallDelta: (Math.random() - 0.5) * 10, // -5 to +5
    moodScore: Math.floor(Math.random() * 30) + 60,
    moodTrend: ["up", "down", "stable"][Math.floor(Math.random() * 3)] as "up" | "down" | "stable",
    energyScore: Math.floor(Math.random() * 30) + 60,
    energyTrend: ["up", "down", "stable"][Math.floor(Math.random() * 3)] as "up" | "down" | "stable",
    stressScore: Math.floor(Math.random() * 30) + 40,
    stressTrend: ["up", "down", "stable"][Math.floor(Math.random() * 3)] as "up" | "down" | "stable",
  };
}

export function WellbeingKPIRow({
  kpis,
  isLoading = false,
}: WellbeingKPIRowProps) {
  const _containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const _itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  if (isLoading || !kpis) {
    return (
      <motion.div
        initial="visible"
        animate="visible"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[1, 2, 3, 4].map((i) => (
          <motion.div key={i} initial={{ opacity: 1 }}>
            <SkeletonCard height="h-40" />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  // Generate mini sparklines
  const generateSparkline = (base: number): number[] => {
    return Array.from({ length: 7 }, () => base + (Math.random() - 0.5) * 20);
  };

  return (
    <motion.div
      initial="visible"
      animate="visible"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* Overall Wellbeing Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="h-full"
      >
        <StatCard
          title="Overall Wellbeing Score"
          value={kpis.overallScore}
          delta={kpis.overallDelta}
          icon={Heart}
          maxValue={100}
        />
      </motion.div>

      {/* Mood Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="h-full"
      >
        <StatCard
          title="Mood Score"
          value={kpis.moodScore}
          trend={kpis.moodTrend}
          sparkline={generateSparkline(kpis.moodScore)}
          icon={Smile}
          maxValue={100}
        />
      </motion.div>

      {/* Energy Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="h-full"
      >
        <StatCard
          title="Energy Score"
          value={kpis.energyScore}
          trend={kpis.energyTrend}
          sparkline={generateSparkline(kpis.energyScore)}
          icon={Zap}
          maxValue={100}
        />
      </motion.div>

      {/* Stress Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="h-full"
      >
        <StatCard
          title="Stress Score"
          value={kpis.stressScore}
          trend={kpis.stressTrend}
          sparkline={generateSparkline(kpis.stressScore)}
          icon={Activity}
          maxValue={100}
        />
      </motion.div>
    </motion.div>
  );
}

