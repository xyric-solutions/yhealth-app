"use client";

/**
 * @file ScheduleView
 * The "Schedule" sub-tab: wraps WorkoutScheduleTasks, WorkoutRescheduleHistory,
 * and WorkoutConstraints in a responsive grid layout.
 */

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import {
  WorkoutScheduleTasks,
  WorkoutRescheduleHistory,
  WorkoutConstraints,
} from "../index";

interface ScheduleViewProps {
  selectedWorkoutId: string;
  rescheduleRefreshKey: number;
  onOpenReschedule: () => void;
  onCreateNew: () => void;
}

export function ScheduleView({
  selectedWorkoutId,
  rescheduleRefreshKey,
  onOpenReschedule,
}: ScheduleViewProps) {
  return (
    <motion.div
      key="schedule"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Workout Schedule Management</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage your workout schedule, constraints, and rescheduling</p>
        </div>
        {selectedWorkoutId && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenReschedule}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reschedule Workouts
          </motion.button>
        )}
      </div>

      {/* Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scheduled Tasks */}
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
          <div className="p-5">
            <WorkoutScheduleTasks workoutPlanId={selectedWorkoutId || undefined} refreshKey={rescheduleRefreshKey} />
          </div>
        </div>

        {/* Reschedule History */}
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
          <div className="p-5">
            <WorkoutRescheduleHistory workoutPlanId={selectedWorkoutId || undefined} refreshKey={rescheduleRefreshKey} />
          </div>
        </div>
      </div>

      {/* Constraints */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: 'linear-gradient(145deg, #0f1219 0%, #0a0d14 100%)' }}>
        <div className="p-5">
          <WorkoutConstraints />
        </div>
      </div>
    </motion.div>
  );
}
