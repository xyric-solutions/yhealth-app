"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Check,
} from "lucide-react";
import Image from "next/image";
import {
  WeekPlan,
  DayWorkout,
  WeekSummary,
  DAY_FULL_LABELS,
} from "./types";
import { CircularProgress, MiniCircularProgress } from "./CircularProgress";

interface WeeklyPlanViewProps {
  planName: string;
  durationWeeks: number;
  currentWeek: number;
  weeks?: Record<string, WeekPlan>;
  weeklySchedule?: Record<string, DayWorkout | null>;
  weeksSummary?: WeekSummary[];
  dailyProgress?: Record<string, number>;
  onWeekChange?: (weekNumber: number) => void;
  onDayClick?: (dayOfWeek: string, workout: DayWorkout) => void;
  startDate?: string;
}

const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function WeeklyPlanView({
  planName,
  durationWeeks,
  currentWeek,
  weeks,
  weeklySchedule,
  weeksSummary,
  dailyProgress = {},
  onWeekChange,
  onDayClick,
  startDate,
}: WeeklyPlanViewProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week);
    onWeekChange?.(week);
  };

  const weekPlan = weeks?.[`week_${selectedWeek}`];
  const weekDays = weekPlan?.days || weeklySchedule || {};

  const getDayProgress = (day: string): number => {
    const weekSpecificKey = `week_${selectedWeek}_${day}`;
    if (dailyProgress[weekSpecificKey] !== undefined) {
      return dailyProgress[weekSpecificKey];
    }
    return dailyProgress[day] || 0;
  };

  const calculateWeekProgress = () => {
    let totalProgress = 0;
    let workoutDays = 0;
    DAYS_ORDER.forEach(day => {
      if (weekDays[day]) {
        workoutDays++;
        totalProgress += getDayProgress(day);
      }
    });
    return workoutDays > 0 ? totalProgress / workoutDays : 0;
  };

  const weekProgress = calculateWeekProgress();

  const getWeekCompletionFromProgress = (week: number): number => {
    const weekDaysForWeek = weeks?.[`week_${week}`]?.days || (week === selectedWeek ? weekDays : {});
    let total = 0;
    let sum = 0;
    DAYS_ORDER.forEach(day => {
      if (weekDaysForWeek[day]) {
        total++;
        const key = `week_${week}_${day}`;
        sum += (dailyProgress[key] ?? 0);
      }
    });
    return total > 0 ? sum / total : 0;
  };

  const toLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayDate = (dayIndex: number): string | null => {
    const dayName = DAYS_ORDER[dayIndex];
    const workout = weekDays[dayName];
    if (workout?.scheduledDate) {
      if (selectedWeek === 1) return workout.scheduledDate;
      const baseDate = new Date(workout.scheduledDate + 'T00:00:00');
      baseDate.setDate(baseDate.getDate() + (selectedWeek - 1) * 7);
      return toLocalDateStr(baseDate);
    }

    if (!startDate) return null;
    const planStart = new Date(startDate + 'T00:00:00');
    const dow = planStart.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(planStart);
    monday.setDate(planStart.getDate() + mondayOffset);
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + (selectedWeek - 1) * 7 + dayIndex);
    return toLocalDateStr(targetDate);
  };

  const formatDayDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatShortDayDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {/* Weekly Plan Details Header */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-slate-700/50 p-4 sm:p-6 backdrop-blur-xl">
        <p className="text-xs text-slate-400 mb-3">Weekly Plan Details</p>

        {/* Title row: Week badge + Plan name + Progress */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 px-2.5 py-1 text-[10px] sm:text-xs font-medium bg-teal-500/15 text-teal-400 rounded-lg border border-teal-500/20">
              Week {selectedWeek}/{durationWeeks}
            </span>
            <h2 className="text-base sm:text-xl font-bold text-white truncate">{planName}</h2>
          </div>

          <div className="flex-shrink-0 text-center">
            <CircularProgress
              percentage={weekProgress}
              size={56}
              strokeWidth={5}
              labelSize="sm"
            />
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Week Progress</p>
          </div>
        </div>

        {/* Week Pills */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {Array.from({ length: durationWeeks }, (_, i) => i + 1).map((week) => {
            const summary = weeksSummary?.find(w => w.weekNumber === week);
            const isSelected = week === selectedWeek;
            const completion = summary?.completionRate ?? (getWeekCompletionFromProgress(week) / 100);
            const isComplete = completion >= 1;

            return (
              <motion.button
                key={week}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleWeekChange(week)}
                className={`
                  flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all
                  ${isSelected
                    ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                    : "bg-slate-700/40 text-slate-400 border border-transparent hover:bg-slate-700/60"
                  }
                `}
              >
                {isSelected && isComplete && (
                  <span className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
                <span>Week {week}</span>
                {!isSelected && <ChevronRight className="w-3 h-3 text-slate-500" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Section Title */}
      <h3 className="text-lg sm:text-xl font-bold text-white">{planName}</h3>

      {/* Daily Workouts Grid — 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <AnimatePresence mode="wait">
          {DAYS_ORDER.map((day, index) => {
            const workout = weekDays[day];
            const isRestDay = !workout;
            const progress = getDayProgress(day);
            const dayDate = getDayDate(index);
            const todayStr = toLocalDateStr(new Date());
            const isToday = dayDate === todayStr;

            return (
              <motion.div
                key={`${selectedWeek}-${day}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => workout && onDayClick?.(day, workout)}
                className={`
                  relative rounded-2xl border transition-all overflow-hidden
                  ${isToday
                    ? "bg-teal-900/40 border-teal-500/40 ring-1 ring-teal-500/30 shadow-lg shadow-teal-500/10 cursor-pointer"
                    : workout
                      ? "bg-slate-800/60 border-slate-700/40 cursor-pointer hover:border-slate-600/50 hover:shadow-lg"
                      : "bg-slate-800/30 border-slate-700/30 cursor-pointer hover:bg-slate-800/50"
                  }
                `}
              >
                {workout ? (
                  <div className="p-4 sm:p-5">
                    {/* Day Header: date pill + progress */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg truncate max-w-[140px] ${
                        isToday
                          ? "bg-teal-500 text-white border border-teal-400"
                          : "bg-teal-500/15 text-teal-400 border border-teal-500/20"
                      }`}>
                        {dayDate ? formatShortDayDate(dayDate) : DAY_FULL_LABELS[day]}
                      </span>
                      <div className="flex-shrink-0">
                        <CircularProgress percentage={progress} size={40} strokeWidth={4} labelSize="sm" />
                      </div>
                    </div>

                    {/* Workout Name */}
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1 break-words leading-tight">
                      {workout.workoutName}
                    </h4>

                    {/* Focus Area / Muscles */}
                    <p className="text-[11px] sm:text-xs text-slate-400 mb-4 line-clamp-2">
                      {workout.focusArea}
                    </p>

                    {/* Stats Row — vertical column layout with Figma icons */}
                    <div className="flex items-end gap-2.5 sm:gap-3">
                      <div className="flex-1 text-center px-2 py-2.5 bg-slate-700/30 rounded-xl">
                        <Image src="/Workout/Frame-2.svg" alt="exercises" width={20} height={20} className="mx-auto mb-1.5" />
                        <p className="text-[10px] sm:text-xs text-white font-bold">{workout.exercises?.length || 0}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-500">exercises</p>
                      </div>

                      <div className="flex-1 text-center px-2 py-2.5 bg-slate-700/30 rounded-xl">
                        <Image src="/Workout/Frame.svg" alt="duration" width={20} height={20} className="mx-auto mb-1.5" />
                        <p className="text-[10px] sm:text-xs text-white font-bold">{workout.estimatedDuration}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-500">mins</p>
                      </div>

                      <div className="flex-1 text-center px-2 py-2.5 bg-slate-700/30 rounded-xl">
                        <Image src="/Workout/Frame-1.svg" alt="calories" width={20} height={20} className="mx-auto mb-1.5" />
                        <p className="text-[10px] sm:text-xs text-white font-bold">{workout.estimatedCalories}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-500">cal</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5">
                    {/* Rest Day Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 text-[10px] sm:text-xs font-medium bg-slate-700/40 text-slate-400 rounded-lg truncate max-w-[140px]">
                        {dayDate ? formatShortDayDate(dayDate) : DAY_FULL_LABELS[day]}
                      </span>
                    </div>

                    {/* Recovery Day Content */}
                    <div className="text-center py-3 sm:py-4">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 rounded-full bg-slate-700/40 flex items-center justify-center">
                        <Image src="/Workout/fi_8090317.svg" alt="rest" width={28} height={28} />
                      </div>
                      <p className="text-sm sm:text-base text-slate-400 font-medium">Recovery Day</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Rest, stretch & recover</p>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Week Notes */}
      {weekPlan?.notes && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/30 rounded-2xl p-4 sm:p-5 border border-slate-700/30"
        >
          <h4 className="text-xs sm:text-sm font-semibold text-slate-400 mb-2">Week Notes</h4>
          <p className="text-sm sm:text-base text-slate-300">{weekPlan.notes}</p>
        </motion.div>
      )}
    </div>
  );
}

export default WeeklyPlanView;
