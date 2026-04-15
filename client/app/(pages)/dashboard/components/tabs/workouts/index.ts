/**
 * @file Workouts Components Index
 * Export all workout-related components
 */

// Components
export { CreateWorkoutModal } from './CreateWorkoutModal';
export { WorkoutCard } from './WorkoutCard';
export { DeleteConfirmModal } from './DeleteConfirmModal';
export { WorkoutCalendar } from './WorkoutCalendar';
export { WeeklyPlanView } from './WeeklyPlanView';
export { DayWorkoutEditModal } from './DayWorkoutEditModal';
export { WorkoutAnalytics } from './WorkoutAnalytics';
export { WorkoutScheduleTasks } from './WorkoutScheduleTasks';
export { WorkoutRescheduleHistory } from './WorkoutRescheduleHistory';
export { WorkoutConstraints } from './WorkoutConstraints';
export { RescheduleWorkoutModal } from './RescheduleWorkoutModal';
export { ExerciseExecutionDrawer } from './ExerciseExecutionDrawer';
export {
  CircularProgress,
  MiniCircularProgress,
  DailyProgressCard,
  WeeklyProgressOverview,
  DonutChart,
} from './CircularProgress';
export { PlanCompletionCelebration, PlanCompletedBanner } from './PlanCompletionCelebration';
export { ActiveSessionBanner } from './ActiveSessionBanner';
export { RestTimerModal } from './RestTimerModal';
export { WorkoutCompletionModal } from './WorkoutCompletionModal';

// Sub-tab views
export { TodayView, PlanView } from './tabs';

// Types
export type {
  Exercise,
  WorkoutPlan,
  WorkoutDay,
  WorkoutSession,
  WorkoutStats,
  PersonalRecord,
  CreateWorkoutFormData,
  AIGenerationFormData,
  DayWorkout,
  AIGeneratedPlan,
  ProgressiveOverload,
  WeekPlan,
  WeeksStructure,
  CalendarDay,
  CalendarMonth,
  WeekSummary,
  PlanCompletionCheck,
  PlanCompletionStats,
} from './types';

// Type constants
export { WORKOUT_TYPE_COLORS, DAY_LABELS, DAY_FULL_LABELS } from './types';

// Constants
export {
  MOTIVATIONAL_QUOTES,
  PRESET_EXERCISES,
  MUSCLE_GROUPS,
  DIFFICULTY_OPTIONS,
  DEFAULT_WORKOUT_STATS,
  DEFAULT_EQUIPMENT,
  EQUIPMENT_OPTIONS,
  LOCATION_OPTIONS,
  GOAL_CATEGORY_OPTIONS,
  DURATION_OPTIONS,
  WORKOUTS_PER_WEEK_OPTIONS,
  TIME_PER_WORKOUT_OPTIONS,
  DAYS_OF_WEEK,
  DAYS_LABELS,
} from './constants';

// Utilities
export {
  isValidUUID,
  formatTime,
  getRandomQuote,
  calculateWorkoutDuration,
  calculateEstimatedCalories,
  checkPlanCompletion,
  buildFullPlanProgress,
  calculatePlanStats,
} from './utils';

// Hooks
export { useWorkoutSession } from './hooks/useWorkoutSession';
export { useWorkoutData } from './hooks/useWorkoutData';

// Logger
export { workoutLogger } from './logger';
