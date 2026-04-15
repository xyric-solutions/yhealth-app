"use client";

/**
 * @file TodayView
 * The "Workout" sub-tab: a 2-column grid with the Figma-matched workout card
 * (header, progress bar, exercise list) on the left and the side panel
 * (weekly progress, this week, recent PRs, AI tip, alarms) on the right.
 */

import { motion } from "framer-motion";
import {
  ChevronRight,
  Calendar,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Circle,
  Sparkles,
  Info,
  BarChart3,
  Heart,
  Trash2,
  Loader2,
  Edit3,
} from "lucide-react";
import { WorkoutAlarmsWidget } from "../../../alarms/WorkoutAlarmsWidget";
import type { Exercise, WorkoutPlan, WorkoutDay, WorkoutStats } from "../types";

interface TodayViewProps {
  selectedWorkout: WorkoutPlan;
  weeklySchedule: WorkoutDay[];
  personalRecords: { exerciseName: string; weight: number; reps: number; improvement: number; date: string }[];
  workoutStats: WorkoutStats;
  progressPercentage: number;
  completedExercises: number;
  totalExercises: number;
  isSavingProgress: boolean;
  onToggleExercise: (exerciseId: string) => void;
  onExerciseClick: (exercise: Exercise) => void;
  onDeletePlan: (planId: string) => void;
  onEditToday: () => void;
}

export function TodayView({
  selectedWorkout,
  weeklySchedule,
  personalRecords,
  progressPercentage,
  completedExercises,
  totalExercises,
  isSavingProgress,
  onToggleExercise,
  onExerciseClick,
  onDeletePlan,
  onEditToday,
}: TodayViewProps) {
  return (
    <motion.div
      key="today"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid lg:grid-cols-3 gap-4 sm:gap-6"
    >
      {/* Today's Workout Card */}
      <div className="lg:col-span-2 space-y-4 min-w-0">
        <div className="rounded-[30px] border border-white/10 overflow-hidden" style={{ backgroundImage: 'linear-gradient(168deg, rgba(2, 132, 199, 0) 17%, rgba(2, 132, 199, 0.2) 99%)' }}>
          {/* Workout Header -- Figma-matched design */}
          <div className="px-6 sm:px-10 py-6 sm:py-8">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl sm:text-2xl font-medium text-white mb-3">{selectedWorkout.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedWorkout.muscleGroups.map((group) => (
                    <span key={group} className="text-sm text-white/40 bg-[#1b1b1b]/10 border border-[#1b1b1b] px-2.5 py-1 rounded">
                      {group}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onDeletePlan(selectedWorkout.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete plan"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onEditToday}
                  className="p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                  title="Edit today's workout"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Progress Section -- Figma linear bar */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base text-[#efedfd]/70 flex items-center gap-2">
                  Todays Progress
                  {isSavingProgress && (
                    <span className="flex items-center gap-1 text-xs text-cyan-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  )}
                </span>
                <span className="text-base font-medium text-[#efedfd]">{completedExercises}/{totalExercises} exercise{totalExercises !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-2.5 flex-1">
                  {/* Track */}
                  <div className="absolute inset-0 rounded-xl bg-white/10" />
                  {/* Glow */}
                  {progressPercentage > 0 && (
                    <div
                      className="absolute top-0 left-0 h-full rounded-xl blur-sm"
                      style={{
                        width: `${progressPercentage}%`,
                        background: 'linear-gradient(90deg, #059669, #10b981, #34d399)',
                        opacity: 0.6,
                      }}
                    />
                  )}
                  {/* Fill */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="absolute top-0 left-0 h-full rounded-xl"
                    style={{ background: 'linear-gradient(90deg, #059669, #10b981, #34d399)' }}
                  />
                </div>
                {/* Percentage */}
                <span className="text-base text-[#efedfd] font-normal shrink-0">
                  {progressPercentage}%
                </span>
              </div>
              {progressPercentage === 100 && (
                <p className="text-sm text-emerald-400 font-medium">Great job! Workout complete!</p>
              )}
            </div>
          </div>

          {/* Exercise List -- Figma card style */}
          <div className="px-6 sm:px-10 pb-6 sm:pb-8 space-y-5">
            {selectedWorkout.exercises.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Heart className="w-8 h-8 text-purple-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Rest Day</h4>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  No workout scheduled for today. Take time to recover and come back stronger!
                </p>
              </div>
            ) : (
              selectedWorkout.exercises.map((exercise, index) => (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`flex items-center gap-4 rounded-[18px] border overflow-hidden px-6 py-5 cursor-pointer transition-all ${
                    exercise.completed
                      ? "bg-[rgba(0,145,76,0.4)] border-[#00914c] opacity-60"
                      : "bg-[rgba(2,0,15,0.5)] border-white/[0.24] hover:border-white/[0.4]"
                  }`}
                  onClick={() => onExerciseClick(exercise)}
                >
                  {/* Checkbox */}
                  <button
                    className="flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); onToggleExercise(exercise.id); }}
                  >
                    {exercise.completed ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </motion.div>
                    ) : (
                      <Circle className="w-6 h-6 text-white/30 hover:text-white/60 transition-colors" />
                    )}
                  </button>

                  {/* Name + Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`font-medium text-lg ${exercise.completed ? "line-through text-white/80" : "text-white"}`}>
                      {exercise.name}
                    </p>
                    <p className={`text-base ${exercise.completed ? "line-through text-[#efedfd]/50" : "text-[#efedfd]/70"}`}>
                      {exercise.sets} sets x {exercise.reps}{exercise.restSeconds ? `, ${exercise.restSeconds}s rest` : ""}
                    </p>
                  </div>

                  {/* Muscle Group */}
                  <span className="text-[17px] text-[#efedfd]/70 hidden sm:block shrink-0">
                    {exercise.muscleGroup}
                  </span>

                  {/* Chevron */}
                  <ChevronRight className="w-6 h-6 text-white/30 -rotate-0 shrink-0" />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="space-y-4 min-w-0">
        {/* Weekly Progress -- Modern horizontal bar design */}
        <div className="rounded-2xl border border-white/[0.06] p-4 sm:p-5" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
          <h4 className="text-white font-semibold mb-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            Weekly Progress
          </h4>

          {/* Daily Progress Rows */}
          <div className="space-y-3 mb-5">
            {weeklySchedule.length > 0 ? (
              weeklySchedule.map((day, index) => {
                const isDone = day.completed;
                const isRest = day.isRest;
                const todayIdx = weeklySchedule.findIndex(d => d.isToday);
                const isUpcoming = !day.isToday && index > todayIdx;

                return (
                  <motion.div
                    key={day.day}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {/* Day label + status */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${
                        day.isToday ? "text-amber-400" :
                        isDone ? "text-emerald-400" :
                        "text-slate-500"
                      }`}>
                        {day.day}
                      </span>
                      <span className={`text-[10px] font-medium italic ${
                        isRest ? "text-slate-600" :
                        isDone ? "text-emerald-400" :
                        isUpcoming ? "text-slate-600" :
                        "text-amber-500"
                      }`}>
                        {isRest ? "Rest" : isDone ? "Done" : isUpcoming ? "Upcoming" : "Pending"}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-[6px] bg-white/[0.04] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: isRest ? "0%" : isDone ? "100%" : day.isToday ? "50%" : "0%" }}
                        transition={{ duration: 0.6, delay: 0.15 + index * 0.08, ease: [0.4, 0, 0.2, 1] }}
                        className={`h-full rounded-full ${
                          isDone ? "bg-gradient-to-r from-emerald-500 to-cyan-400" :
                          day.isToday ? "bg-gradient-to-r from-amber-500 to-orange-400" :
                          "bg-transparent"
                        }`}
                        style={isDone || day.isToday ? { boxShadow: isDone ? '0 0 8px rgba(16,185,129,0.3)' : '0 0 8px rgba(245,158,11,0.3)' } : {}}
                      />
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No schedule data available
              </p>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
            {(() => {
              const completed = weeklySchedule.filter(d => d.completed).length;
              const remaining = weeklySchedule.filter(d => !d.completed && !d.isRest).length;
              const total = weeklySchedule.filter(d => !d.isRest).length;
              const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <>
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-400">{completed}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-400">{remaining}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Remaining</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-cyan-400">{rate}%</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Rate</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Weekly Schedule Mini */}
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-3 sm:p-5">
          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            This Week
          </h4>
          <div className="space-y-2">
            {weeklySchedule.length > 0 ? (
              weeklySchedule.map((day) => (
                <div
                  key={day.day}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    day.isToday ? "bg-orange-500/10 border border-orange-500/30" : ""
                  }`}
                >
                  <span className={`text-xs font-medium w-8 ${day.isToday ? "text-orange-400" : "text-slate-500"}`}>
                    {day.day}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm ${day.isRest ? "text-slate-500 italic" : "text-white"}`}>
                      {day.name}
                    </p>
                    {day.scheduledTime && !day.isRest && (
                      <p className="text-xs text-slate-500">{day.scheduledTime}</p>
                    )}
                  </div>
                  {day.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : day.isRest ? (
                    <Heart className="w-4 h-4 text-pink-400/50" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600" />
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                Create a workout plan to see your weekly schedule
              </p>
            )}
          </div>
        </div>

        {/* AI Tip */}
        <div className="rounded-2xl bg-sky-500/[0.06] border border-sky-500/40 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
              <Info className="w-3.5 h-3.5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <h4 className="text-white font-semibold text-sm mb-0.5">AI Tip</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Based on your progress, try increasing your bench press weight by 2.5kg next session. You&apos;re ready!
              </p>
            </div>
          </div>
        </div>

        {/* Personal Records */}
        <div className="rounded-2xl bg-amber-500/[0.04] border border-dashed border-amber-500/40 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm mb-0.5">Recent PRs</h4>
              {personalRecords.length > 0 ? (
                <div className="space-y-1.5 mt-1.5">
                  {personalRecords.slice(0, 3).map((pr, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <TrendingUp className="w-3 h-3 text-amber-300 shrink-0" />
                      <span className="text-xs text-white truncate">{pr.exerciseName}</span>
                      <span className="text-[11px] text-slate-400">{pr.weight}kg × {pr.reps}</span>
                      <span className="ml-auto text-[11px] text-amber-300 font-semibold">+{pr.improvement}kg</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  Complete workouts to set new personal records!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Workout Alarms Widget */}
        <WorkoutAlarmsWidget />

      </div>
    </motion.div>
  );
}
