/**
 * @file Workout Reschedule API Service
 * @description Centralized API calls for workout rescheduling operations
 */

import { api } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export type PlanPolicy = 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS';

export interface WorkoutScheduleTask {
  id: string;
  userId: string;
  workoutPlanId: string;
  taskId: string;
  name: string;
  scheduledDate: string;
  originalScheduledDate: string | null;
  intensity: 'light' | 'medium' | 'hard';
  muscleGroups: string[];
  status: 'pending' | 'completed' | 'skipped' | 'partial' | 'missed';
  rescheduleCount: number;
  workoutLogId: string | null;
  estimatedDurationMinutes: number | null;
}

export interface MissedTask {
  taskId: string;
  scheduledDate: string;
  workoutPlanId: string;
  workoutData: Record<string, unknown>;
  intensity: 'light' | 'medium' | 'hard';
  muscleGroups: string[];
  daysMissed: number;
}

export interface RescheduleHistory {
  id: string;
  userId: string;
  workoutPlanId: string;
  rescheduleDate: string;
  reason: string;
  policyApplied: PlanPolicy;
  changes: {
    tasksRescheduled: number;
    tasksDropped: number;
    newSchedule: Array<{
      taskId: string;
      oldDate: string;
      newDate: string;
    }>;
  };
  aiSummary: string | null;
  aiFeedback: string | null;
  createdAt: string;
}

export interface UserWorkoutConstraints {
  id: string;
  userId: string;
  maxSessionsPerWeek: number;
  maxHardSessionsPerWeek: number;
  maxSessionsPerDay: number;
  availableDays: string[]; // e.g., ['monday', 'wednesday', 'friday']
  restDays: string[];
  minRestHoursBetweenSessions: number;
  minRestHoursAfterHeavyLeg: number;
  preferredWorkoutTimes: Record<string, string[]>; // day -> time slots
  muscleGroupRecoveryHours: Record<string, number>;
  avoidConsecutiveDays: boolean;
  maxWeeklyVolume: number;
  customRules: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditResult {
  tasksChecked: number;
  tasksMarkedMissed: number;
  missedTasks: MissedTask[];
}

export interface RescheduleResult {
  actions: Array<{
    action: 'move' | 'drop' | 'compress';
    taskId: string;
    oldDate?: string;
    newDate?: string;
    reason?: string;
  }>;
  summary: string;
  historyId: string;
}

// ============================================
// SERVICE
// ============================================

export const workoutRescheduleService = {
  /**
   * Manually trigger workout audit
   */
  triggerAudit: () =>
    api.post<AuditResult>('/workouts/reschedule/audit'),

  /**
   * Trigger auto-reschedule for a workout plan
   */
  triggerReschedule: (workoutPlanId: string, policy?: PlanPolicy) =>
    api.post<RescheduleResult>('/workouts/reschedule/auto', {
      workoutPlanId,
      policy,
    }),

  /**
   * Get reschedule history for user
   */
  getRescheduleHistory: (workoutPlanId?: string, limit?: number) => {
    const params: Record<string, string> = {};
    if (workoutPlanId) params.workoutPlanId = workoutPlanId;
    if (limit) params.limit = limit.toString();
    return api.get<{ history: RescheduleHistory[] }>('/workouts/reschedule/history', { params });
  },

  /**
   * Get user workout constraints
   */
  getConstraints: () =>
    api.get<{ constraints: UserWorkoutConstraints | null }>('/workouts/reschedule/constraints'),

  /**
   * Update user workout constraints
   */
  updateConstraints: (updates: Partial<{
    maxSessionsPerWeek: number;
    maxHardSessionsPerWeek: number;
    maxSessionsPerDay: number;
    availableDays: string[];
    restDays: string[];
    minRestHoursBetweenSessions: number;
    minRestHoursAfterHeavyLeg: number;
    preferredWorkoutTimes: Record<string, string[]>;
    muscleGroupRecoveryHours: Record<string, number>;
    avoidConsecutiveDays: boolean;
    maxWeeklyVolume: number;
  }>) =>
    api.put<{ constraints: UserWorkoutConstraints }>('/workouts/reschedule/constraints', updates),

  /**
   * Get all scheduled tasks for user
   */
  getScheduledTasks: (workoutPlanId?: string, status?: string, limit?: number) => {
    const params: Record<string, string> = {};
    if (workoutPlanId) params.workoutPlanId = workoutPlanId;
    if (status) params.status = status;
    if (limit) params.limit = limit.toString();
    return api.get<{ tasks: WorkoutScheduleTask[]; count: number }>('/workouts/reschedule/scheduled-tasks', { params });
  },

  /**
   * Get current missed tasks for user
   */
  getMissedTasks: (workoutPlanId?: string) => {
    const params: Record<string, string> = {};
    if (workoutPlanId) params.workoutPlanId = workoutPlanId;
    return api.get<{ missedTasks: MissedTask[]; count: number }>('/workouts/reschedule/missed-tasks', { params });
  },

  /**
   * Auto-check and reschedule missed workouts (called on app open)
   * This silently audits all previous days and auto-reschedules if needed
   */
  autoCheckAndReschedule: () =>
    api.post<{
      audited: boolean;
      missedTasks: number;
      rescheduled: boolean;
      plansProcessed: number;
      plansRescheduled: number;
      totalActions: number;
      results: Array<{
        workoutPlanId: string;
        success: boolean;
        actionsCount: number;
        summary?: string;
      }>;
      message: string;
    }>('/workouts/reschedule/auto-check'),
};

