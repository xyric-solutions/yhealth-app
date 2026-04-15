/**
 * @file useWorkoutData
 * Manages workout plans, stats, schedule, personal records, daily progress,
 * and all CRUD/persistence operations.
 */

import { useState, useCallback, useEffect } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { workoutsService, type WorkoutLog } from "@/src/shared/services";

import {
  isValidUUID,
  checkPlanCompletion,
  buildFullPlanProgress,
  calculatePlanStats,
} from "../utils";
import { DEFAULT_WORKOUT_STATS } from "../constants";
import { workoutLogger } from "../logger";
import type {
  Exercise,
  WorkoutPlan,
  WorkoutStats,
  WorkoutDay,
  DayWorkout,
  PlanCompletionStats,
} from "../types";

// ──────────────────────────────────────────────────────────────────────
// Helpers (pure functions, no hooks)
// ──────────────────────────────────────────────────────────────────────

/** Calculate the current week number from a plan's start date. */
function calculateCurrentWeek(startDateStr: string, durationWeeks: number): number {
  const start = new Date(startDateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  return Math.min(Math.max(1, weekNumber), durationWeeks);
}

/** Check if a program has passed its end date. */
function isProgramPastEndDate(startDateStr: string, durationWeeks: number): boolean {
  const start = new Date(startDateStr + "T00:00:00");
  const endDate = new Date(start);
  endDate.setDate(start.getDate() + durationWeeks * 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= endDate;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ──────────────────────────────────────────────────────────────────────
// Local types
// ──────────────────────────────────────────────────────────────────────

interface PR {
  exerciseName: string;
  weight: number;
  reps: number;
  improvement: number;
  date: string;
}

// ──────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────

interface UseWorkoutDataReturn {
  // State
  workouts: WorkoutPlan[];
  setWorkouts: React.Dispatch<React.SetStateAction<WorkoutPlan[]>>;
  selectedWorkout: WorkoutPlan | null;
  selectedWorkoutId: string;
  setSelectedWorkoutId: React.Dispatch<React.SetStateAction<string>>;
  weeklySchedule: WorkoutDay[];
  workoutStats: WorkoutStats;
  personalRecords: PR[];
  dailyProgress: Record<string, number>;
  isLoadingPlans: boolean;
  isSavingProgress: boolean;
  // Computed
  completedExercises: number;
  totalExercises: number;
  progressPercentage: number;
  // Plan completion
  showPlanCompletion: boolean;
  setShowPlanCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  planCompletionStats: PlanCompletionStats | null;
  setPlanCompletionStats: React.Dispatch<React.SetStateAction<PlanCompletionStats | null>>;
  // CRUD
  toggleExercise: (exerciseId: string, sessionActive: boolean, sessionElapsedSeconds: number, onRestStart: (seconds: number) => void, onAllCompleted: () => void) => Promise<void>;
  updateExerciseWeight: (exerciseId: string, weight: string) => void;
  handleDeleteWorkout: (workoutId: string) => Promise<void>;
  handleSaveDayWorkout: (dayOfWeek: string, updatedWorkout: DayWorkout | null) => Promise<void>;
  handleDragEnd: (event: DragEndEvent) => void;
  calculateDailyProgress: (
    schedule: Array<{ day: string; dayName: string; isRest: boolean; planId?: string }>,
    workoutPlans: WorkoutPlan[],
    weekNumber?: number,
    planStartDate?: string
  ) => Promise<void>;
  refreshProgress: () => Promise<void>;
  checkAndShowPlanCompletion: () => Promise<void>;
}

export function useWorkoutData(): UseWorkoutDataReturn {
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WorkoutDay[]>([]);
  const [workoutStats, setWorkoutStats] = useState<WorkoutStats>(DEFAULT_WORKOUT_STATS);
  const [personalRecords, setPersonalRecords] = useState<PR[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>("");
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [showPlanCompletion, setShowPlanCompletion] = useState(false);
  const [planCompletionStats, setPlanCompletionStats] = useState<PlanCompletionStats | null>(null);

  const [dailyProgress, setDailyProgress] = useState<Record<string, number>>({
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0,
  });

  // Computed
  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId) || null;
  const completedExercises = selectedWorkout?.exercises.filter((e) => e.completed).length || 0;
  const totalExercises = selectedWorkout?.exercises.length || 0;
  const progressPercentage = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;

  // ──────────────────────────────────────────────────────────────────
  // calculateDailyProgress
  // ──────────────────────────────────────────────────────────────────

  const calculateDailyProgress = useCallback(
    async (
      schedule: Array<{ day: string; dayName: string; isRest: boolean; planId?: string }>,
      workoutPlans: WorkoutPlan[],
      weekNumber?: number,
      planStartDate?: string
    ) => {
      const dayNameMapping: Record<string, string> = {
        Mon: "monday",
        Tue: "tuesday",
        Wed: "wednesday",
        Thu: "thursday",
        Fri: "friday",
        Sat: "saturday",
        Sun: "sunday",
      };

      const newDailyProgress: Record<string, number> = {};

      let startOfWeek: Date;

      if (planStartDate && weekNumber) {
        const planStart = new Date(planStartDate + "T00:00:00");
        const planStartDayOfWeek = planStart.getDay();
        const normalizedStartDay = planStartDayOfWeek === 0 ? 6 : planStartDayOfWeek - 1;
        const week1Start = new Date(planStart);
        week1Start.setDate(planStart.getDate() - normalizedStartDay);
        startOfWeek = new Date(week1Start);
        startOfWeek.setDate(week1Start.getDate() + (weekNumber - 1) * 7);
        startOfWeek.setHours(0, 0, 0, 0);
      } else {
        const today = new Date();
        const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dayOfWeek = todayLocal.getDay();
        startOfWeek = new Date(todayLocal);
        startOfWeek.setDate(todayLocal.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        startOfWeek.setHours(0, 0, 0, 0);
      }

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      try {
        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          weekDates.push(formatLocalDate(date));
        }

        const logsByDate: Record<string, WorkoutLog[]> = {};
        for (const dateStr of weekDates) {
          try {
            const logsResponse = await workoutsService.getLogsForDate(dateStr);
            const logs = logsResponse.data?.logs || [];
            logsByDate[dateStr] = logs;
          } catch {
            logsByDate[dateStr] = [];
          }
        }

        schedule.forEach((day, index) => {
          const dayKey = dayNameMapping[day.day] || day.dayName;
          if (!dayKey) return;

          const dateForDay = new Date(startOfWeek);
          dateForDay.setDate(startOfWeek.getDate() + index);
          const dateStr = formatLocalDate(dateForDay);

          let progressValue = 0;

          if (!day.isRest) {
            const dayLogs = logsByDate[dateStr] || [];
            const planLogs = day.planId
              ? dayLogs.filter((l: WorkoutLog) => l.workoutPlanId === day.planId)
              : dayLogs;

            if (planLogs.length > 0) {
              const plan = workoutPlans.find((p) => p.id === day.planId);
              if (!plan) {
                const completedLog = planLogs.find(
                  (l: WorkoutLog) => l.status === "completed" || l.status === "partial"
                );
                progressValue = completedLog ? 100 : 0;
              } else {
                let dayWorkout: DayWorkout | null | undefined;
                const ws = plan.weeklySchedule as Record<string, DayWorkout | null> | undefined;
                const weeks = plan.weeks;

                if (weeks) {
                  const targetWeek = weekNumber || plan.currentWeek || 1;
                  const weekPlan = weeks[`week_${targetWeek}`];
                  dayWorkout = weekPlan?.days?.[dayKey];
                }
                if (!dayWorkout && ws) {
                  dayWorkout = ws[dayKey];
                }

                const totalEx = dayWorkout?.exercises?.length || plan.exercises?.length || 0;

                if (totalEx > 0) {
                  const latestLog = planLogs[planLogs.length - 1];
                  if (latestLog?.exercisesCompleted && Array.isArray(latestLog.exercisesCompleted)) {
                    const completedCount = latestLog.exercisesCompleted.length;
                    progressValue = Math.round((completedCount / totalEx) * 100);
                  } else if (latestLog?.status === "completed") {
                    progressValue = 100;
                  } else if (latestLog?.status === "partial") {
                    progressValue = 50;
                  }
                }
              }
            }
          }

          newDailyProgress[dateStr] = progressValue;
          if (weekNumber) {
            newDailyProgress[`week_${weekNumber}_${dayKey}`] = progressValue;
          }
          newDailyProgress[dayKey] = progressValue;
        });
      } catch (err) {
        workoutLogger.error("Failed to calculate daily progress", err, {
          component: "useWorkoutData",
        });
        schedule.forEach((day, index) => {
          const dayKey = dayNameMapping[day.day] || day.dayName;
          const dateForDay = new Date(startOfWeek);
          dateForDay.setDate(startOfWeek.getDate() + index);
          const dateStr = formatLocalDate(dateForDay);
          const progressValue = 0;
          if (dayKey) {
            newDailyProgress[dayKey] = progressValue;
          }
          newDailyProgress[dateStr] = progressValue;
        });
      }

      setDailyProgress((prev) => ({ ...prev, ...newDailyProgress }));
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────
  // restoreCompletionState
  // ──────────────────────────────────────────────────────────────────

  const restoreCompletionState = useCallback(async (workoutPlans: WorkoutPlan[]) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    try {
      const logsResponse = await workoutsService.getLogsForDate(todayStr);
      const logs = logsResponse.data?.logs;
      if (logs && logs.length > 0) {
        const logByPlanId = new Map<string, WorkoutLog>();
        const allCompletedById = new Map<string, { weight?: number }>();
        const allCompletedByName = new Map<string, { weight?: number }>();

        for (const log of logs) {
          if (log.workoutPlanId) {
            logByPlanId.set(log.workoutPlanId, log);
          }
          if (log.exercisesCompleted && Array.isArray(log.exercisesCompleted)) {
            for (const ec of log.exercisesCompleted) {
              const savedWeight = ec.sets?.find((s: { completed: boolean }) => s.completed)?.weight;
              allCompletedById.set(ec.exerciseId, { weight: savedWeight });
              if (ec.notes) {
                allCompletedByName.set(ec.notes, { weight: savedWeight });
              }
            }
          }
        }

        if (allCompletedById.size > 0 || allCompletedByName.size > 0) {
          setWorkouts(
            workoutPlans.map((workout) => {
              const planLog = logByPlanId.get(workout.id);
              let completedById = allCompletedById;
              let completedByName = allCompletedByName;
              if (planLog?.exercisesCompleted && Array.isArray(planLog.exercisesCompleted)) {
                completedById = new Map<string, { weight?: number }>();
                completedByName = new Map<string, { weight?: number }>();
                for (const ec of planLog.exercisesCompleted) {
                  const savedWeight = ec.sets?.find((s: { completed: boolean }) => s.completed)
                    ?.weight;
                  completedById.set(ec.exerciseId, { weight: savedWeight });
                  if (ec.notes) {
                    completedByName.set(ec.notes, { weight: savedWeight });
                  }
                }
              }

              return {
                ...workout,
                exercises: workout.exercises.map((ex) => {
                  const matchById = completedById.get(ex.id);
                  const matchByName = completedByName.get(ex.name);
                  const match = matchById || matchByName;
                  if (match) {
                    return {
                      ...ex,
                      completed: true,
                      weight: match.weight ? `${match.weight}kg` : ex.weight,
                    };
                  }
                  return { ...ex, completed: false };
                }),
              };
            })
          );
          return;
        }
      }
    } catch (err) {
      workoutLogger.error("Failed to restore workout completion state", err, {
        component: "useWorkoutData",
      });
    }
    setWorkouts(workoutPlans);
  }, []);

  // ──────────────────────────────────────────────────────────────────
  // Initial data load
  // ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadWorkoutData = async () => {
      setIsLoadingPlans(true);
      workoutLogger.info("Loading workout data", {
        component: "useWorkoutData",
        action: "loadWorkoutData",
      });

      try {
        const [plansResponse, statsResponse, scheduleResponse, prsResponse] = await Promise.all([
          workoutsService.getPlans().catch(() => null),
          workoutsService.getWeeklyStats().catch(() => null),
          workoutsService.getWeeklySchedule().catch(() => null),
          workoutsService.getPersonalRecords(5).catch(() => null),
        ]);

        // Process workout plans
        const plans = plansResponse?.data?.plans;
        let mappedPlans: WorkoutPlan[] = [];
        if (plans && plans.length > 0) {
          const days = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
          ];
          const todayKey = days[new Date().getDay()];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mappedPlans = plans.map((plan: any) => {
            let exercises: Exercise[] = [];
            const weeklySchedule = plan.weeklySchedule as
              | Record<string, DayWorkout | null>
              | undefined;

            if (weeklySchedule && weeklySchedule[todayKey]) {
              const todayWorkout = weeklySchedule[todayKey];
              exercises = (todayWorkout?.exercises || []).map(
                (ex: DayWorkout["exercises"][number], idx: number) => ({
                  id: ex.id || `${plan.id}-${todayKey}-${idx}`,
                  name: ex.name,
                  sets: ex.sets,
                  reps: String(ex.reps),
                  weight: ex.weight ? String(ex.weight) : undefined,
                  restSeconds: ex.restSeconds || 60,
                  muscleGroup: ex.muscleGroup || "Full Body",
                  completed: false,
                })
              );
            }

            if (exercises.length === 0 && plan.exercises && plan.exercises.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              exercises = plan.exercises.map((ex: any) => ({
                id: ex.id,
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                duration: ex.duration,
                restSeconds: ex.restSeconds,
                muscleGroup: ex.muscleGroup,
                completed: false,
              }));
            }

            let muscleGroups = plan.muscleGroups || [];
            if (muscleGroups.length === 0 && weeklySchedule) {
              const allMuscleGroups = new Set<string>();
              Object.values(weeklySchedule).forEach((day) => {
                if (day && day.focusArea) {
                  day.focusArea.split(",").forEach((m: string) => allMuscleGroups.add(m.trim()));
                }
                if (day && day.exercises) {
                  day.exercises.forEach((ex) => {
                    if (ex.muscleGroup) allMuscleGroups.add(ex.muscleGroup);
                  });
                }
              });
              muscleGroups = Array.from(allMuscleGroups);
            }

            const planStartDate = plan.startDate || plan.start_date;
            const planDurationWeeks = plan.durationWeeks || plan.duration_weeks || 4;
            const dynamicCurrentWeek = planStartDate
              ? calculateCurrentWeek(planStartDate, planDurationWeeks)
              : plan.currentWeek || plan.current_week || 1;
            const programComplete =
              planStartDate && planDurationWeeks > 1
                ? isProgramPastEndDate(planStartDate, planDurationWeeks)
                : false;

            return {
              id: plan.id,
              name: plan.name,
              description: plan.description,
              muscleGroups,
              exercises,
              duration: plan.duration || 45,
              scheduledTime: plan.scheduledTime,
              difficulty: (plan.difficulty || plan.initialDifficultyLevel || "beginner") as
                | "beginner"
                | "intermediate"
                | "advanced",
              isCustom: plan.isCustom || !plan.aiGenerated,
              weeklySchedule,
              weeks: plan.weeks,
              scheduleDays: plan.scheduleDays || plan.schedule_days,
              durationWeeks: planDurationWeeks,
              startDate: planStartDate,
              endDate: plan.endDate || plan.end_date,
              currentWeek: dynamicCurrentWeek,
              isProgramComplete: programComplete,
            };
          });
          setSelectedWorkoutId(mappedPlans[0]?.id || "");

          await restoreCompletionState(mappedPlans);
        } else {
          setWorkouts([]);
          setSelectedWorkoutId("");
        }

        // Process weekly stats
        const stats = statsResponse?.data?.stats;
        if (stats) {
          setWorkoutStats({
            weeklyWorkouts: stats.weeklyWorkouts || 0,
            weeklyGoal: stats.weeklyGoal || 5,
            totalMinutes: stats.totalMinutes || 0,
            caloriesBurned: stats.caloriesBurned || 0,
            currentStreak: stats.currentStreak || 0,
          });
        }

        // Process weekly schedule and calculate daily progress
        const schedule = scheduleResponse?.data?.schedule;
        if (schedule && schedule.length > 0) {
          setWeeklySchedule(
            schedule.map((day: WorkoutDay) => ({
              day: day.day,
              name: day.name,
              completed: day.completed,
              isToday: day.isToday,
              isRest: day.isRest,
              scheduledTime: day.scheduledTime,
              planId: day.planId,
            }))
          );

          if (mappedPlans.length > 0) {
            const selPlan =
              mappedPlans.find((p) => p.id === selectedWorkoutId) || mappedPlans[0];
            const weekNumber = selPlan?.currentWeek || 1;
            const startDate = selPlan?.startDate;
            await calculateDailyProgress(schedule, mappedPlans, weekNumber, startDate);
          }
        }

        // Process personal records
        const records = prsResponse?.data?.records;
        if (records && records.length > 0) {
          setPersonalRecords(
            records.map((pr: PR) => ({
              exerciseName: pr.exerciseName,
              weight: pr.weight,
              reps: pr.reps,
              improvement: pr.improvement,
              date: pr.date,
            }))
          );
        }
      } catch (err) {
        workoutLogger.error("Failed to load workout data", err, {
          component: "useWorkoutData",
          action: "loadWorkoutData",
        });
        setWorkouts([]);
        setSelectedWorkoutId("");
      } finally {
        setIsLoadingPlans(false);
        workoutLogger.logAPI("fetch", "workout-data", { success: true, component: "useWorkoutData" });
      }
    };

    loadWorkoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreCompletionState]);

  // ──────────────────────────────────────────────────────────────────
  // CRUD operations
  // ──────────────────────────────────────────────────────────────────

  /** Toggle an exercise's completed state and persist to API. */
  const toggleExercise = useCallback(
    async (
      exerciseId: string,
      sessionActive: boolean,
      sessionElapsedSeconds: number,
      onRestStart: (seconds: number) => void,
      onAllCompleted: () => void
    ) => {
      const workout = workouts.find((w) => w.id === selectedWorkoutId);
      if (!workout) return;

      const exercise = workout.exercises.find((e) => e.id === exerciseId);
      if (!exercise) return;

      const newCompletedState = !exercise.completed;

      // Update local state immediately (optimistic)
      setWorkouts((prev) =>
        prev.map((w) => {
          if (w.id !== selectedWorkoutId) return w;

          const updatedExercises = w.exercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, completed: newCompletedState } : ex
          );

          const allCompleted = updatedExercises.every((ex) => ex.completed);
          if (allCompleted && sessionActive) {
            setTimeout(() => onAllCompleted(), 500);
          }

          if (newCompletedState && sessionActive && exercise.restSeconds) {
            onRestStart(exercise.restSeconds);
          }

          return { ...w, exercises: updatedExercises };
        })
      );

      // Persist to API
      setIsSavingProgress(true);
      try {
        const allCompletedExercises = workout.exercises
          .filter((ex) => {
            if (ex.id === exerciseId) return newCompletedState;
            return ex.completed;
          })
          .map((ex) => {
            const repsStr = ex.reps || "10";
            const repsNum = parseInt(repsStr.split("-")[0]) || 10;
            const weightStr = ex.weight || "0";
            const weightNum = parseFloat(weightStr.replace(/[^0-9.]/g, "")) || 0;
            const setsArray = Array.from({ length: ex.sets || 1 }, () => ({
              reps: repsNum,
              weight: weightNum,
              completed: true,
            }));
            return { exerciseId: ex.id, sets: setsArray, notes: ex.name };
          });

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        await workoutsService.logWorkout({
          ...(isValidUUID(selectedWorkoutId) ? { workoutPlanId: selectedWorkoutId } : {}),
          scheduledDate: todayStr,
          workoutName: workout.name,
          exercisesCompleted: allCompletedExercises,
          durationMinutes: sessionElapsedSeconds
            ? Math.round(sessionElapsedSeconds / 60)
            : undefined,
        });

        workoutLogger.debug("Workout progress saved", {
          component: "useWorkoutData",
          exerciseId,
          newState: newCompletedState,
          totalCompleted: allCompletedExercises.length,
        });

        // Refresh daily progress
        if (weeklySchedule.length > 0) {
          const scheduleForProgress = weeklySchedule.map((day) => ({
            day: day.day,
            dayName: day.name,
            isRest: day.isRest || false,
            planId: day.planId,
          }));
          const selPlan = workouts.find((w) => w.id === selectedWorkoutId);
          const weekNumber = selPlan?.currentWeek || 1;
          const startDate = selPlan?.startDate;
          await calculateDailyProgress(scheduleForProgress, workouts, weekNumber, startDate);
        }
      } catch (err) {
        workoutLogger.error("Failed to save workout progress", err, {
          component: "useWorkoutData",
        });
      } finally {
        setIsSavingProgress(false);
      }
    },
    [workouts, selectedWorkoutId, weeklySchedule, calculateDailyProgress]
  );

  /** Update exercise weight from execution drawer. */
  const updateExerciseWeight = useCallback(
    (exerciseId: string, weight: string) => {
      setWorkouts((prev) =>
        prev.map((w) => {
          if (w.id !== selectedWorkoutId) return w;
          return {
            ...w,
            exercises: w.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, weight } : ex)),
          };
        })
      );
    },
    [selectedWorkoutId]
  );

  /** Delete a workout plan. */
  const handleDeleteWorkout = useCallback(
    async (workoutId: string) => {
      workoutLogger.info("Deleting workout plan", { planId: workoutId, component: "useWorkoutData" });

      setWorkouts((prev) => {
        const filtered = prev.filter((w) => w.id !== workoutId);
        if (selectedWorkoutId === workoutId && filtered.length > 0) {
          setSelectedWorkoutId(filtered[0].id);
        }
        return filtered;
      });

      if (isValidUUID(workoutId)) {
        try {
          await workoutsService.deletePlan(workoutId);
          workoutLogger.logAPI("delete", "workout-plan", { success: true, planId: workoutId });
        } catch (error) {
          workoutLogger.error("Failed to delete workout plan from API", error, {
            planId: workoutId,
          });
        }
      }
    },
    [selectedWorkoutId]
  );

  /** Save a single day workout within the weekly schedule. */
  const handleSaveDayWorkout = useCallback(
    async (dayOfWeek: string, updatedWorkout: DayWorkout | null) => {
      if (!selectedWorkout) return;

      workoutLogger.info("Saving day workout", {
        component: "useWorkoutData",
        action: "saveDayWorkout",
        dayOfWeek,
        planId: selectedWorkout.id,
      });

      try {
        const currentSchedule = (selectedWorkout.weeklySchedule || {}) as Record<
          string,
          DayWorkout | null
        >;
        const updatedSchedule = { ...currentSchedule };
        updatedSchedule[dayOfWeek] = updatedWorkout;

        if (isValidUUID(selectedWorkout.id)) {
          await workoutsService.updatePlan(selectedWorkout.id, {
            weeklySchedule: updatedSchedule,
          });
        }

        const updatedWorkoutPlan: WorkoutPlan = {
          ...selectedWorkout,
          weeklySchedule: updatedSchedule,
        };

        setWorkouts((prev) =>
          prev.map((w) => (w.id === selectedWorkout.id ? updatedWorkoutPlan : w))
        );

        // Refresh daily progress
        if (weeklySchedule.length > 0) {
          const scheduleResponse = await workoutsService.getWeeklySchedule(selectedWorkout.id);
          const schedule = scheduleResponse.data?.schedule;
          if (schedule && schedule.length > 0) {
            const weekNumber = selectedWorkout.currentWeek || 1;
            const startDate = selectedWorkout.startDate;
            await calculateDailyProgress(schedule, workouts, weekNumber, startDate);
          }
        }

        workoutLogger.logAPI("update", "day-workout", { success: true, dayOfWeek });
      } catch (error) {
        workoutLogger.error("Failed to save day workout", error, { component: "useWorkoutData" });
        throw error;
      }
    },
    [selectedWorkout, weeklySchedule, workouts, calculateDailyProgress]
  );

  /** Reorder workouts via drag-and-drop. */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWorkouts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        workoutLogger.info("Workout plans reordered", {
          component: "useWorkoutData",
          action: "reorder",
          fromIndex: oldIndex,
          toIndex: newIndex,
        });

        return newItems;
      });
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────
  // Convenience helpers called by the parent
  // ──────────────────────────────────────────────────────────────────

  /** Refresh daily progress using current weeklySchedule data. */
  const refreshProgress = useCallback(async () => {
    if (weeklySchedule.length > 0) {
      try {
        const scheduleResponse = await workoutsService.getWeeklySchedule(selectedWorkoutId);
        const schedule = scheduleResponse.data?.schedule;
        if (schedule && schedule.length > 0) {
          const selPlan = workouts.find((w) => w.id === selectedWorkoutId);
          const weekNumber = selPlan?.currentWeek || 1;
          const startDate = selPlan?.startDate;
          await calculateDailyProgress(schedule, workouts, weekNumber, startDate);
        }
      } catch (err) {
        workoutLogger.error("Failed to refresh progress", err, { component: "useWorkoutData" });
      }
    }
  }, [weeklySchedule, selectedWorkoutId, workouts, calculateDailyProgress]);

  /** Check if the selected plan is fully complete and show celebration. */
  const checkAndShowPlanCompletion = useCallback(async () => {
    const plan = workouts.find((w) => w.id === selectedWorkoutId);
    if (plan && plan.durationWeeks && plan.durationWeeks > 1 && plan.status !== "completed") {
      try {
        const fullProgress = await buildFullPlanProgress(plan);
        const check = checkPlanCompletion(plan, fullProgress);
        if (check.isComplete) {
          const stats = await calculatePlanStats(plan, check);
          setPlanCompletionStats(stats);
          setShowPlanCompletion(true);
          if (isValidUUID(plan.id)) {
            await workoutsService.updatePlan(plan.id, { status: "completed" });
            setWorkouts((prev) =>
              prev.map((w) => (w.id === plan.id ? { ...w, status: "completed" } : w))
            );
          }
        }
      } catch (err) {
        workoutLogger.error("Plan completion check failed", err, { component: "useWorkoutData" });
      }
    }
  }, [workouts, selectedWorkoutId]);

  return {
    workouts,
    setWorkouts,
    selectedWorkout,
    selectedWorkoutId,
    setSelectedWorkoutId,
    weeklySchedule,
    workoutStats,
    personalRecords,
    dailyProgress,
    isLoadingPlans,
    isSavingProgress,
    completedExercises,
    totalExercises,
    progressPercentage,
    showPlanCompletion,
    setShowPlanCompletion,
    planCompletionStats,
    setPlanCompletionStats,
    toggleExercise,
    updateExerciseWeight,
    handleDeleteWorkout,
    handleSaveDayWorkout,
    handleDragEnd,
    calculateDailyProgress,
    refreshProgress,
    checkAndShowPlanCompletion,
  };
}
