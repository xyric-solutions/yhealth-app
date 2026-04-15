"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { Dumbbell, Target, Zap, ChevronRight } from "lucide-react";
import type { ExerciseListItem } from "@/src/shared/services/exercises.service";

interface ExerciseListRowProps {
  exercise: ExerciseListItem;
  index: number;
}

const difficultyColors: Record<string, { bg: string; text: string; glow: string }> = {
  beginner: { bg: "bg-emerald-500/15", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
  intermediate: { bg: "bg-amber-500/15", text: "text-amber-400", glow: "shadow-amber-500/10" },
  advanced: { bg: "bg-red-500/15", text: "text-red-400", glow: "shadow-red-500/10" },
  expert: { bg: "bg-purple-500/15", text: "text-purple-400", glow: "shadow-purple-500/10" },
};

export function ExerciseListRow({ exercise, index }: ExerciseListRowProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isVideo = exercise.animation_url?.endsWith(".mp4");
  const thumbnailSrc = isVideo ? (exercise.thumbnail_url || exercise.animation_url) : (exercise.animation_url || exercise.thumbnail_url);
  const hasImage = !imageError && (exercise.animation_url || exercise.thumbnail_url);
  const difficulty = difficultyColors[exercise.difficulty_level] || difficultyColors.beginner;

  return (
    <Link href={`/exercises/${exercise.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.2) }}
        whileHover={{ x: 4 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative"
      >
        {/* Glow effect */}
        <motion.div
          animate={{ opacity: isHovered ? 0.06 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 blur-2xl pointer-events-none"
        />

        <div className="relative flex items-center gap-4 p-3 rounded-xl cursor-pointer bg-slate-900/80 backdrop-blur-sm border border-white/[0.04] hover:border-emerald-500/20 hover:bg-slate-800/60 transition-all duration-300">
          {/* Gradient left accent */}
          <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Thumbnail */}
          <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc || ""}
                alt={exercise.name}
                loading="lazy"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Dumbbell className="w-6 h-6 text-slate-600" />
              </div>
            )}
            {/* Subtle glow behind thumbnail */}
            <motion.div
              animate={{ opacity: isHovered ? 0.2 : 0 }}
              className="absolute -inset-1 rounded-xl bg-emerald-500/20 blur-md -z-10"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors duration-300">
              {exercise.name}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Target className="w-3 h-3 text-emerald-400" />
                {exercise.primary_muscle_group || exercise.body_part || "Full Body"}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Zap className="w-3 h-3 text-emerald-400" />
                {exercise.default_sets}×{exercise.default_reps}
              </span>
            </div>
          </div>

          {/* Tags */}
          <div className="hidden sm:flex items-center gap-2">
            {exercise.equipment_required?.slice(0, 1).map((eq) => (
              <span key={eq} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-500 border border-white/[0.06]">
                {eq}
              </span>
            ))}
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shadow-sm ${difficulty.bg} ${difficulty.text} ${difficulty.glow}`}>
              {exercise.difficulty_level}
            </span>
          </div>

          {/* Arrow */}
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
        </div>
      </motion.div>
    </Link>
  );
}
