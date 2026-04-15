"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import {
  Dumbbell,
  Zap,
  Target,
  ChevronRight,
  Play,
} from "lucide-react";
import type { ExerciseListItem } from "@/src/shared/services/exercises.service";

interface ExerciseCardProps {
  exercise: ExerciseListItem;
  index: number;
}

const difficultyConfig: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  beginner: { label: "Beginner", color: "text-emerald-300", bg: "bg-emerald-500/20", glow: "shadow-emerald-500/20" },
  intermediate: { label: "Intermediate", color: "text-amber-300", bg: "bg-amber-500/20", glow: "shadow-amber-500/20" },
  advanced: { label: "Advanced", color: "text-red-300", bg: "bg-red-500/20", glow: "shadow-red-500/20" },
  expert: { label: "Expert", color: "text-purple-300", bg: "bg-purple-500/20", glow: "shadow-purple-500/20" },
};

export function ExerciseCard({ exercise, index }: ExerciseCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const difficulty = difficultyConfig[exercise.difficulty_level] || difficultyConfig.beginner;
  const isVideo = exercise.animation_url?.endsWith(".mp4");
  const mediaSrc = isVideo ? exercise.thumbnail_url : (exercise.animation_url || exercise.thumbnail_url);
  const hasImage = !imageError && (exercise.animation_url || exercise.thumbnail_url);

  return (
    <Link href={`/exercises/${exercise.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.3) }}
        whileHover={{ y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative cursor-pointer"
      >
        {/* Animated gradient border */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-emerald-500/0 via-teal-500/0 to-emerald-500/0 group-hover:from-emerald-500/40 group-hover:via-teal-500/40 group-hover:to-emerald-500/40 transition-all duration-500 blur-[1px]" />

        {/* Glow effect */}
        <motion.div
          animate={{ opacity: isHovered ? 0.12 : 0 }}
          transition={{ duration: 0.4 }}
          className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 blur-3xl pointer-events-none"
        />

        {/* Card body */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 shadow-lg hover:shadow-emerald-500/10">
          {/* Image / Animation Section */}
          <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
            {hasImage ? (
              <>
                {isVideo ? (
                  <video
                    src={exercise.animation_url || ""}
                    poster={exercise.thumbnail_url || undefined}
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaSrc || ""}
                    alt={exercise.name}
                    loading="lazy"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                {/* Play button on hover */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="relative">
                    {/* Pulse ring */}
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-emerald-500/30"
                    />
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-600/40">
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    </div>
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                <Dumbbell className="w-12 h-12 text-slate-700" />
              </div>
            )}

            {/* Difficulty badge */}
            <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${difficulty.bg} ${difficulty.color} backdrop-blur-sm shadow-lg ${difficulty.glow}`}>
              {difficulty.label}
            </div>

            {/* Category badge */}
            {exercise.category && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900/70 text-slate-300 backdrop-blur-sm border border-white/10">
                {exercise.category}
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 space-y-3">
            {/* Exercise name */}
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors duration-300">
              {exercise.name}
            </h3>

            {/* Muscle groups */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Target className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="truncate">
                {exercise.primary_muscle_group || exercise.body_part || "Full Body"}
              </span>
            </div>

            {/* Tags row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {exercise.equipment_required?.slice(0, 2).map((eq) => (
                <span
                  key={eq}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-white/[0.06]"
                >
                  {eq}
                </span>
              ))}
              {(exercise.equipment_required?.length || 0) > 2 && (
                <span className="text-[10px] text-slate-500">
                  +{exercise.equipment_required.length - 2}
                </span>
              )}
            </div>

            {/* Footer with defaults */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  {exercise.default_sets}×{exercise.default_reps}
                </span>
                {exercise.calories_per_minute && (
                  <span className="flex items-center gap-1 text-amber-400/70">
                    {Math.round(exercise.calories_per_minute)} cal/min
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </div>
          </div>

          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.4), transparent 50%), radial-gradient(circle at 70% 30%, rgba(20, 184, 166, 0.4), transparent 50%)`,
            }}
          />
        </div>
      </motion.div>
    </Link>
  );
}
