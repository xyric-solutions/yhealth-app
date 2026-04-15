"use client";

import { motion } from "framer-motion";
import {
  Dumbbell,
  Clock,
  Flame,
  ChevronRight,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import type { WorkoutPlan } from "./types";

interface WorkoutCardProps {
  workout: WorkoutPlan;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  completedExercises?: number;
}

export function WorkoutCard({
  workout,
  isSelected,
  onSelect,
  onDelete,
  completedExercises = 0,
}: WorkoutCardProps) {
  const totalExercises = workout.exercises.length;
  const progressPercentage = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;
  const isCompleted = progressPercentage === 100;

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "text-emerald-400 bg-emerald-400/10";
      case "intermediate":
        return "text-amber-400 bg-amber-400/10";
      case "advanced":
        return "text-red-400 bg-red-400/10";
      default:
        return "text-slate-400 bg-slate-400/10";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
        isSelected
          ? "bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/50"
          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`p-1.5 sm:p-2 rounded-xl flex-shrink-0 ${isSelected ? "bg-orange-500/20" : "bg-slate-700/50"}`}>
            <Dumbbell className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? "text-orange-400" : "text-slate-400"}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm sm:text-base text-white truncate">{workout.name}</h4>
              {isCompleted && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              {totalExercises} exercises • {workout.muscleGroups.join(", ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Difficulty Badge */}
          <span className={`hidden sm:inline px-2 py-1 rounded-lg text-xs font-medium capitalize ${getDifficultyColor(workout.difficulty)}`}>
            {workout.difficulty}
          </span>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? "text-orange-400" : "text-slate-500"}`} />
        </div>
      </div>

      {/* Progress Bar */}
      {progressPercentage > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Progress</span>
            <span className="text-xs text-slate-300">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              className={`h-full rounded-full ${
                isCompleted ? "bg-emerald-500" : "bg-orange-500"
              }`}
            />
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{workout.duration || workout.exercises.length * 8} min</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className="w-3 h-3" />
          <span>~{workout.exercises.length * 25} cal</span>
        </div>
        {workout.scheduledTime && (
          <div className="flex items-center gap-1">
            <span>@ {workout.scheduledTime}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
