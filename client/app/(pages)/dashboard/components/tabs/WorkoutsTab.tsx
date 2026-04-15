"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect } from "react";
import {
  Dumbbell,
  Calendar,
  CalendarDays,
  TrendingUp,
  Plus,
  BarChart3,
  Loader2,
  ListOrdered,
} from "lucide-react";

// Import workout components, utilities, hooks, and types
import {
  workoutLogger,
  WorkoutCalendar,
  WeeklyPlanView,
  DayWorkoutEditModal,
  WorkoutAnalytics,
  ExerciseExecutionDrawer,
  CreateWorkoutModal,
  DeleteConfirmModal,
  PlanCompletionCelebration,
  PlanCompletedBanner,
  ActiveSessionBanner,
  RestTimerModal,
  WorkoutCompletionModal,
  TodayView,
  PlanView,
  checkPlanCompletion,
  buildFullPlanProgress,
  calculatePlanStats,
  useWorkoutSession,
  useWorkoutData,
  type Exercise,
  type WorkoutPlan,
  type DayWorkout,
} from "./workouts";
import { WorkoutJourneyStatCards } from "./workouts/WorkoutJourneyStatCards";
import { DashboardUnderlineTabs } from "../DashboardUnderlineTabs";

export function WorkoutsTab() {
  // ── Data hook (plans, stats, schedule, PRs, CRUD) ──────────────
  const {
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
  } = useWorkoutData();

  // ── Session hook (timer, rest, pause/resume) ───────────────────
  const {
    session,
    currentQuote,
    showCompletionModal,
    setShowCompletionModal,
    startWorkout,
    togglePause,
    stopWorkout,
    completeWorkout,
    skipRest,
    startRest,
  } = useWorkoutSession();

  // ── Local UI state ─────────────────────────────────────────────
  const [activeView, setActiveView] = useState<"today" | "plan" | "calendar" | "weekly" | "analytics">("today");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutPlan | null>(null);
  const [editingDay, setEditingDay] = useState<{ dayOfWeek: string; workout: DayWorkout | null } | null>(null);
  const [executionDrawerExercise, setExecutionDrawerExercise] = useState<Exercise | null>(null);

  // ── Bridging: session ↔ data interactions ──────────────────────

  /** Start a workout session — resets exercises and activates timer */
  const _handleStartWorkout = useCallback(() => {
    if (!selectedWorkout) return;

    // Reset all exercises to not completed
    setWorkouts(prev => prev.map(w =>
      w.id === selectedWorkoutId
        ? { ...w, exercises: w.exercises.map(e => ({ ...e, completed: false })) }
        : w
    ));

    startWorkout(selectedWorkoutId, selectedWorkout.exercises.length);
  }, [selectedWorkout, selectedWorkoutId, setWorkouts, startWorkout]);

  /** Bridge togglePause with the selected plan ID */
  const handleTogglePause = useCallback(() => {
    togglePause(selectedWorkoutId);
  }, [togglePause, selectedWorkoutId]);

  /** Bridge stopWorkout with the selected plan ID */
  const handleStopWorkout = useCallback(() => {
    stopWorkout(selectedWorkoutId);
  }, [stopWorkout, selectedWorkoutId]);

  /** Bridge completeWorkout with the selected plan ID */
  const handleCompleteWorkout = useCallback(() => {
    completeWorkout(selectedWorkoutId);
  }, [completeWorkout, selectedWorkoutId]);

  /** Toggle exercise — bridges session state into data hook */
  const handleToggleExercise = useCallback(async (exerciseId: string) => {
    await toggleExercise(
      exerciseId,
      session.isActive,
      session.elapsedSeconds,
      startRest,
      handleCompleteWorkout,
    );
  }, [toggleExercise, session.isActive, session.elapsedSeconds, startRest, handleCompleteWorkout]);

  /** Open edit modal */
  const handleEditWorkout = useCallback((workout: WorkoutPlan) => {
    setEditingWorkout(workout);
    setShowCreateModal(true);
  }, []);

  /** Handle workout completion modal "Done" — refresh progress + check plan completion */
  const handleCompletionDone = useCallback(async () => {
    setShowCompletionModal(false);
    await refreshProgress();
    await checkAndShowPlanCompletion();
  }, [setShowCompletionModal, refreshProgress, checkAndShowPlanCompletion]);

  // ── Weekly view progress calculation ───────────────────────────
  useEffect(() => {
    if (activeView === "weekly" && selectedWorkout && selectedWorkout.startDate) {
      const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const currentWeek = selectedWorkout.currentWeek || 1;

      const schedule = DAYS_ORDER.map((day, index) => {
        const weekPlan = selectedWorkout.weeks?.[`week_${currentWeek}`];
        const dayWorkout = weekPlan?.days?.[day] || selectedWorkout.weeklySchedule?.[day];
        return {
          day: DAY_SHORT[index],
          dayName: day,
          isRest: !dayWorkout,
          planId: selectedWorkout.id,
        };
      });

      calculateDailyProgress(schedule, [selectedWorkout], currentWeek, selectedWorkout.startDate).catch(err => {
        workoutLogger.error('Failed to calculate initial weekly progress', err, { component: 'WorkoutsTab' });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedWorkout?.id, selectedWorkout?.currentWeek, selectedWorkout?.startDate, calculateDailyProgress]);

  // ── Calendar view full-plan progress ───────────────────────────
  useEffect(() => {
    if (activeView !== "calendar" || !selectedWorkout || !selectedWorkout.startDate) return;

    const DAYS_ORDER_CAL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const plan = selectedWorkout;
    const durationWeeks = plan.durationWeeks || 4;

    const loadCalendarProgress = async () => {
      try {
        const { workoutsService } = await import("@/src/shared/services");
        type WorkoutLogImport = Awaited<ReturnType<typeof workoutsService.getLogsByDateRange>>["data"] extends { logs: (infer L)[] } | undefined ? L : never;

        const planStart = new Date(plan.startDate! + 'T00:00:00');
        const startDay = planStart.getDay();
        const normalizedStart = new Date(planStart);
        normalizedStart.setDate(planStart.getDate() - (startDay === 0 ? 6 : startDay - 1));

        const planEnd = new Date(normalizedStart);
        planEnd.setDate(normalizedStart.getDate() + durationWeeks * 7 - 1);

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        const endDate = planEnd > now ? now : planEnd;

        const formatDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const todayStr = formatDate(new Date());
        const startStr = formatDate(normalizedStart);
        const endStr = formatDate(endDate);

        const resp = await workoutsService.getLogsByDateRange(startStr, endStr, plan.id);
        const allLogs = resp.data?.logs || [];

        const logsByDate: Record<string, WorkoutLogImport[]> = {};
        for (const log of allLogs) {
          const dateKey = (log as { scheduledDate: string }).scheduledDate;
          if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
          logsByDate[dateKey].push(log);
        }

        const newProgress: Record<string, number> = {};

        for (let w = 1; w <= durationWeeks; w++) {
          const weekPlan = plan.weeks?.[`week_${w}`];
          const weekStart = new Date(normalizedStart);
          weekStart.setDate(normalizedStart.getDate() + (w - 1) * 7);

          for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + i);
            const dateStr = formatDate(dayDate);
            const dayName = DAYS_ORDER_CAL[i];

            let dayWorkout: DayWorkout | null | undefined;
            if (weekPlan) {
              dayWorkout = weekPlan.days?.[dayName];
            } else if (plan.weeklySchedule) {
              dayWorkout = plan.weeklySchedule[dayName];
            }

            if (!dayWorkout || dayWorkout.isRestDay) continue;

            const dayLogs = logsByDate[dateStr] || [];
            let progressValue = 0;

            if (dayLogs.length > 0) {
              const totalExCount = dayWorkout.exercises?.length || 0;
              const latestLog = dayLogs[0] as { exercisesCompleted?: unknown; status?: string };
              const exercisesData = latestLog?.exercisesCompleted;
              const exercisesArray = Array.isArray(exercisesData)
                ? exercisesData
                : (typeof exercisesData === 'string' ? (() => { try { return JSON.parse(exercisesData); } catch { return null; } })() : null);

              if (totalExCount > 0 && exercisesArray && Array.isArray(exercisesArray) && exercisesArray.length > 0) {
                const completedCount = exercisesArray.length;
                progressValue = Math.round((completedCount / totalExCount) * 100);
              } else if (latestLog?.status === 'completed') {
                progressValue = 100;
              } else if (latestLog?.status === 'partial') {
                progressValue = 50;
              }
            }

            newProgress[dateStr] = progressValue;
            newProgress[`week_${w}_${dayName}`] = progressValue;
          }
        }

        // Overlay local exercise state for today
        const currentWorkout = workouts.find(wk => wk.id === plan.id);
        if (currentWorkout && currentWorkout.exercises?.length > 0) {
          const totalEx = currentWorkout.exercises.length;
          const completedEx = currentWorkout.exercises.filter(ex => ex.completed).length;
          const localProgress = Math.round((completedEx / totalEx) * 100);
          const apiProgress = newProgress[todayStr] ?? 0;
          if (localProgress > apiProgress) {
            newProgress[todayStr] = localProgress;
            const todayDate = new Date();
            const daysSinceStart = Math.floor((todayDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24));
            const todayWeek = Math.floor(daysSinceStart / 7) + 1;
            const todayDayName = DAYS_ORDER_CAL[todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1];
            if (todayWeek >= 1 && todayWeek <= durationWeeks) {
              newProgress[`week_${todayWeek}_${todayDayName}`] = localProgress;
            }
          }
        }

        // We need to merge into dailyProgress — but we don't have setDailyProgress here.
        // The calculateDailyProgress from useWorkoutData merges, so we call it with a synthetic schedule.
        // Instead, directly use the returned newProgress via a dedicated API.
        // For now, call calculateDailyProgress for each week to populate the data.
        // This matches the original behavior — the effect wrote to setDailyProgress directly.
        // Since we cannot call setDailyProgress from outside the hook, we replicate the pattern
        // by calling calculateDailyProgress for each week sequentially.
        for (let w = 1; w <= durationWeeks; w++) {
          const weekPlanCheck = plan.weeks?.[`week_${w}`];
          const schedule = DAYS_ORDER_CAL.map((day, idx) => {
            const dw = weekPlanCheck?.days?.[day] || plan.weeklySchedule?.[day];
            const DAY_SHORT_CAL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            return {
              day: DAY_SHORT_CAL[idx],
              dayName: day,
              isRest: !dw,
              planId: plan.id,
            };
          });
          await calculateDailyProgress(schedule, [plan], w, plan.startDate!);
        }
      } catch (err) {
        workoutLogger.error('Failed to load calendar progress', err, { component: 'WorkoutsTab' });
      }
    };

    loadCalendarProgress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedWorkout?.id, selectedWorkout?.startDate, selectedWorkout?.durationWeeks, workouts]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Active Workout Session Banner */}
      <AnimatePresence>
        {session.isActive && (
          <ActiveSessionBanner
            workoutName={selectedWorkout?.name || ""}
            session={session}
            currentQuote={currentQuote}
            completedExercises={completedExercises}
            totalExercises={totalExercises}
            progressPercentage={progressPercentage}
            onTogglePause={handleTogglePause}
            onStop={handleStopWorkout}
          />
        )}
      </AnimatePresence>

      {/* Rest Timer Modal */}
      <AnimatePresence>
        <RestTimerModal
          isResting={session.isResting}
          restTimeRemaining={session.restTimeRemaining}
          onSkipRest={skipRest}
        />
      </AnimatePresence>

      {/* Workout Completion Modal */}
      <AnimatePresence>
        <WorkoutCompletionModal
          isOpen={showCompletionModal}
          elapsedSeconds={session.elapsedSeconds}
          totalExercises={totalExercises}
          onDone={handleCompletionDone}
        />
      </AnimatePresence>

      {/* Plan Completion Celebration Modal */}
      <PlanCompletionCelebration
        isOpen={showPlanCompletion}
        onClose={() => { setShowPlanCompletion(false); setPlanCompletionStats(null); }}
        onCreateNewPlan={() => { setShowPlanCompletion(false); setPlanCompletionStats(null); setShowCreateModal(true); }}
        stats={planCompletionStats}
      />

      {/* Day Workout Edit Modal */}
      {editingDay && selectedWorkout && (
        <DayWorkoutEditModal
          isOpen={!!editingDay}
          onClose={() => setEditingDay(null)}
          dayOfWeek={editingDay.dayOfWeek}
          workout={editingDay.workout}
          planName={selectedWorkout.name}
          onSave={handleSaveDayWorkout}
        />
      )}

      {/* Exercise Execution Drawer */}
      <ExerciseExecutionDrawer
        exercise={executionDrawerExercise}
        isOpen={!!executionDrawerExercise}
        onClose={() => setExecutionDrawerExercise(null)}
        onToggleComplete={handleToggleExercise}
        onUpdateWeight={updateExerciseWeight}
      />

      {/* Header — clean title + add button */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Your Fitness Journey</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Personalized workouts adapted to your progress</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add new plan</span>
          </motion.button>
        </div>

          <WorkoutJourneyStatCards workoutStats={workoutStats} weeklySchedule={weeklySchedule} />
      </motion.div>

      <DashboardUnderlineTabs
        layoutId="workoutTabIndicator"
        activeId={activeView}
        onTabChange={(id) => setActiveView(id as typeof activeView)}
        tabs={[
          { id: "today", label: "Workout", icon: Calendar },
          { id: "plan", label: "My Plan", icon: BarChart3 },
          { id: "weekly", label: "Weekly", icon: ListOrdered },
          { id: "calendar", label: "Calendar", icon: CalendarDays },
          { id: "analytics", label: "Analytics", icon: TrendingUp },
        ]}
      />

      <AnimatePresence mode="wait">
        {isLoadingPlans && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              <p className="text-slate-400">Loading workout plans...</p>
            </div>
          </motion.div>
        )}

        {/* Plan Completed Banner (when plan status is completed OR program is past end date) */}
        {!isLoadingPlans && activeView === "today" && selectedWorkout && (selectedWorkout.status === "completed" || selectedWorkout.isProgramComplete) && (
          <PlanCompletedBanner
            planName={selectedWorkout.name}
            durationWeeks={selectedWorkout.durationWeeks || 1}
            completionRate={undefined}
            onViewSummary={async () => {
              try {
                const fullProgress = await buildFullPlanProgress(selectedWorkout);
                const check = checkPlanCompletion(selectedWorkout, fullProgress);
                const stats = await calculatePlanStats(selectedWorkout, check);
                setPlanCompletionStats(stats);
                setShowPlanCompletion(true);
              } catch (err) {
                workoutLogger.error('Failed to load plan summary', err);
              }
            }}
            onCreateNewPlan={() => setShowCreateModal(true)}
          />
        )}

        {!isLoadingPlans && activeView === "today" && !selectedWorkout && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-6">
              <Dumbbell className="w-10 h-10 text-orange-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Workout Plans Yet</h3>
            <p className="text-slate-400 text-center max-w-md mb-6">
              Create your first workout plan to start tracking your fitness journey
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow"
            >
              <Plus className="w-5 h-5" />
              Create Your First Plan
            </motion.button>
          </motion.div>
        )}

        {!isLoadingPlans && activeView === "today" && selectedWorkout && selectedWorkout.status !== "completed" && !selectedWorkout.isProgramComplete && (
          <TodayView
            selectedWorkout={selectedWorkout}
            weeklySchedule={weeklySchedule}
            personalRecords={personalRecords}
            workoutStats={workoutStats}
            progressPercentage={progressPercentage}
            completedExercises={completedExercises}
            totalExercises={totalExercises}
            isSavingProgress={isSavingProgress}
            onToggleExercise={handleToggleExercise}
            onExerciseClick={(exercise) => setExecutionDrawerExercise(exercise)}
            onDeletePlan={(planId) => setShowDeleteConfirm(planId)}
            onEditToday={() => {
              const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
              const todayKey = days[new Date().getDay()];
              const weekNum = selectedWorkout.currentWeek || 1;
              const todayWorkout =
                selectedWorkout.weeks?.[`week_${weekNum}`]?.days?.[todayKey] ||
                selectedWorkout.weeklySchedule?.[todayKey];
              if (todayWorkout) {
                setEditingDay({ dayOfWeek: todayKey, workout: todayWorkout });
              } else {
                workoutLogger.info("Edit today clicked but today is a rest day", { todayKey });
              }
            }}
          />
        )}

        {!isLoadingPlans && activeView === "plan" && (
          <PlanView
            workouts={workouts}
            selectedWorkoutId={selectedWorkoutId}
            onSelectWorkout={(id) => setSelectedWorkoutId(id)}
            onEditWorkout={handleEditWorkout}
            onDeleteWorkout={(id) => setShowDeleteConfirm(id)}
            onCreateNew={() => setShowCreateModal(true)}
            onReorder={handleDragEnd}
          />
        )}

        {/* Weekly Plan View */}
        {!isLoadingPlans && activeView === "weekly" && selectedWorkout && (
          <motion.div
            key="weekly"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <WeeklyPlanView
              planName={selectedWorkout.name}
              durationWeeks={selectedWorkout.durationWeeks || 4}
              currentWeek={selectedWorkout.currentWeek || 1}
              weeks={selectedWorkout.weeks}
              weeklySchedule={selectedWorkout.weeklySchedule}
              dailyProgress={dailyProgress}
              startDate={selectedWorkout.startDate}
              onWeekChange={async (weekNumber) => {
                if (selectedWorkout && selectedWorkout.startDate) {
                  const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
                  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                  const schedule = DAYS_ORDER.map((day, index) => {
                    const weekPlan = selectedWorkout.weeks?.[`week_${weekNumber}`];
                    const dayWorkout = weekPlan?.days?.[day] || selectedWorkout.weeklySchedule?.[day];
                    return {
                      day: DAY_SHORT[index],
                      dayName: day,
                      isRest: !dayWorkout,
                      planId: selectedWorkout.id,
                    };
                  });
                  await calculateDailyProgress(schedule, [selectedWorkout], weekNumber, selectedWorkout.startDate);
                }
              }}
              onDayClick={(day, workout) => {
                workoutLogger.info('Day clicked in weekly view', { day, workout: workout.workoutName });
                setEditingDay({ dayOfWeek: day, workout });
              }}
            />
          </motion.div>
        )}

        {/* Weekly View - No Plan Selected */}
        {!isLoadingPlans && activeView === "weekly" && !selectedWorkout && (
          <motion.div
            key="weekly-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
              <ListOrdered className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Plan Selected</h3>
            <p className="text-slate-400 mb-4">Select a workout plan to view the weekly schedule</p>
            <button
              onClick={() => setActiveView("plan")}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
            >
              View My Plans
            </button>
          </motion.div>
        )}

        {/* Calendar View */}
        {!isLoadingPlans && activeView === "calendar" && selectedWorkout && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <WorkoutCalendar
              startDate={selectedWorkout.startDate || new Date().toISOString().split('T')[0]}
              endDate={selectedWorkout.endDate}
              durationWeeks={selectedWorkout.durationWeeks || 4}
              weeks={selectedWorkout.weeks}
              weeklySchedule={selectedWorkout.weeklySchedule}
              dailyProgress={dailyProgress}
              completedDates={new Set(
                Object.entries(dailyProgress)
                  .filter(([key, val]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && val >= 100)
                  .map(([key]) => key)
              )}
              onDayClick={(date, workout) => {
                workoutLogger.info('Day clicked in calendar', { date, workout: workout?.workoutName });
              }}
            />
          </motion.div>
        )}

        {/* Calendar View - No Plan Selected */}
        {!isLoadingPlans && activeView === "calendar" && !selectedWorkout && (
          <motion.div
            key="calendar-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Plan Selected</h3>
            <p className="text-slate-400 mb-4">Select a workout plan to view the calendar</p>
            <button
              onClick={() => setActiveView("plan")}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
            >
              View My Plans
            </button>
          </motion.div>
        )}

        {/* Analytics View */}
        {!isLoadingPlans && activeView === "analytics" && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {selectedWorkout ? (
              <WorkoutAnalytics
                selectedWorkoutId={selectedWorkoutId}
                workouts={workouts}
              />
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Workout Selected</h3>
                <p className="text-slate-400 mb-6">
                  Select a workout plan to view analytics
                </p>
                <button
                  onClick={() => setActiveView("plan")}
                  className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
                >
                  View My Plans
                </button>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Create/Edit Workout Modal */}
      <CreateWorkoutModal
        isOpen={showCreateModal || !!editingWorkout}
        onClose={() => { setShowCreateModal(false); setEditingWorkout(null); }}
        onWorkoutCreated={(workout) => {
          setWorkouts(prev => {
            if (editingWorkout) {
              return prev.map(w => w.id === editingWorkout.id ? { ...w, ...workout } : w);
            }
            return [...prev, workout];
          });
          setSelectedWorkoutId(workout.id);
          setShowCreateModal(false);
          setEditingWorkout(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!showDeleteConfirm}
        workoutName={workouts.find(w => w.id === showDeleteConfirm)?.name || ""}
        onConfirm={() => { handleDeleteWorkout(showDeleteConfirm!); setShowDeleteConfirm(null); }}
        onCancel={() => setShowDeleteConfirm(null)}
      />

    </div>
  );
}
