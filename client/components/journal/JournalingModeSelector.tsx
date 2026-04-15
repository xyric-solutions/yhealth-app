"use client";

/**
 * @file JournalingModeSelector Component
 * @description Card grid for selecting a journaling mode before entering the editor.
 * Five modes: Quick Reflection, Deep Dive, Gratitude, Life Perspective, Free Write.
 */

import { motion } from "framer-motion";
import {
  Zap,
  Compass,
  Heart,
  Eye,
  Feather,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { JournalingMode } from "@shared/types/domain/wellbeing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModeOption {
  mode: JournalingMode;
  label: string;
  description: string;
  duration: string;
  icon: LucideIcon;
  gradient: string;
}

export interface JournalingModeSelectorProps {
  onSelect: (mode: JournalingMode) => void;
  selectedMode?: JournalingMode | null;
}

// ---------------------------------------------------------------------------
// Mode definitions
// ---------------------------------------------------------------------------

const MODES: ModeOption[] = [
  {
    mode: "quick_reflection",
    label: "Quick Reflection",
    description: "1 prompt, light writing",
    duration: "2-3 min",
    icon: Zap,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    mode: "deep_dive",
    label: "Deep Dive",
    description: "Multi-prompt, expansive",
    duration: "10-15 min",
    icon: Compass,
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    mode: "gratitude",
    label: "Gratitude",
    description: "Structured 3-things format",
    duration: "5 min",
    icon: Heart,
    gradient: "from-rose-500 to-pink-500",
  },
  {
    mode: "life_perspective",
    label: "Life Perspective",
    description: "Identity & values focused",
    duration: "10 min",
    icon: Eye,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    mode: "free_write",
    label: "Free Write",
    description: "Stream of consciousness",
    duration: "Any",
    icon: Feather,
    gradient: "from-emerald-500 to-teal-500",
  },
];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JournalingModeSelector({
  onSelect,
  selectedMode = null,
}: JournalingModeSelectorProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      role="radiogroup"
      aria-label="Select journaling mode"
    >
      {MODES.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedMode === option.mode;

        return (
          <motion.button
            key={option.mode}
            variants={cardVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(option.mode)}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.label} - ${option.description} - ${option.duration}`}
            className={`
              relative overflow-hidden rounded-2xl p-5 text-left
              border backdrop-blur-xl transition-all duration-300
              bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80
              hover:shadow-lg hover:shadow-white/5
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
              ${
                isSelected
                  ? "border-emerald-400/60 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/20"
                  : "border-white/10 hover:border-white/20"
              }
            `}
          >
            {/* Subtle gradient overlay on hover */}
            <div
              className={`
                absolute inset-0 opacity-0 transition-opacity duration-300
                bg-gradient-to-br ${option.gradient}
                ${isSelected ? "opacity-[0.08]" : "group-hover:opacity-[0.05]"}
              `}
              style={{ opacity: isSelected ? 0.08 : undefined }}
            />

            <div className="relative z-10 space-y-3">
              {/* Icon */}
              <div
                className={`
                  inline-flex items-center justify-center w-11 h-11 rounded-xl
                  bg-gradient-to-br ${option.gradient} shadow-lg
                `}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>

              {/* Label */}
              <h3 className="text-base font-semibold text-white">
                {option.label}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-400 leading-relaxed">
                {option.description}
              </p>

              {/* Duration badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                <Clock className="w-3 h-3" />
                {option.duration}
              </span>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
