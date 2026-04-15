/**
 * @file Workout Types
 * Shared types for workout components
 */

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  duration?: string;
  restSeconds?: number;
  completed: boolean;
  muscleGroup: string;
  libraryExerciseId?: string;
  thumbnailUrl?: string;
}

// Progressive overload settings
export interface ProgressiveOverload {
  enabled: boolean;
  weightIncrementPercent: number; // e.g., 5 = 5% increase per week
  repsIncrement: number; // e.g., 1 = +1 rep per week
  deloadWeek?: number; // Which week is deload (e.g., 4)
  deloadMultiplier?: number; // e.g., 0.85 = 85% of normal load
}

// Day-wise workout schedule
export interface DayWorkout {
  dayOfWeek: string;
  workoutName: string;
  focusArea: string;
  exercises: {
    id?: string;
    name: string;
    sets: number;
    reps: string;
    restSeconds: number;
    muscleGroup: string;
    weight?: string;
  }[];
  estimatedDuration: number;
  estimatedCalories: number;
  multiplier?: number; // Progressive overload multiplier for this day
  isRestDay?: boolean;
  notes?: string;
  scheduledDate?: string; // YYYY-MM-DD — auto-computed from plan startDate + day offset
  scheduledTime?: string; // HH:mm — user-defined per day
}

// Week-level plan structure
export interface WeekPlan {
  weekNumber: number;
  multiplier: number; // Overall multiplier for this week
  days: Record<string, DayWorkout | null>; // monday, tuesday, etc.
  isDeloadWeek?: boolean;
  notes?: string;
}

// Full weeks structure
export type WeeksStructure = Record<string, WeekPlan>; // week_1, week_2, etc.

export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  muscleGroups: string[];
  exercises: Exercise[];
  duration: number;
  durationWeeks?: number;
  scheduledTime?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  isCustom: boolean;
  status?: string;
  // Legacy field
  weeklySchedule?: Record<string, DayWorkout | null>;
  // New week-by-week structure
  weeks?: WeeksStructure;
  scheduleDays?: string[]; // ['monday', 'tuesday', 'thursday', 'friday']
  progressiveOverload?: ProgressiveOverload;
  currentWeek?: number;
  currentDay?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isProgramComplete?: boolean;
}

export interface WorkoutDay {
  day: string;
  name: string;
  completed: boolean;
  isToday: boolean;
  isRest?: boolean;
  scheduledTime?: string;
  planId?: string;
}

export interface WorkoutSession {
  isActive: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
}

export interface WorkoutStats {
  weeklyWorkouts: number;
  weeklyGoal: number;
  totalMinutes: number;
  caloriesBurned: number;
  currentStreak: number;
}

export interface PersonalRecord {
  exerciseName: string;
  weight: number;
  reps: number;
  improvement: number;
  date: string;
}

export interface CreateWorkoutFormData {
  name: string;
  description: string;
  muscleGroups: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  scheduledTime: string;
  exercises: Exercise[];
  useAI: boolean;
  aiPrompt: string;
  workoutsPerWeek?: number;
  selectedDays?: string[]; // Selected days of the week: ['monday', 'tuesday', etc.]
  startDate: string; // YYYY-MM-DD — plan start date
}

// AI Generation form data
export interface AIGenerationFormData {
  description: string;
  durationWeeks: number;
  workoutsPerWeek: number;
  timePerWorkout: number;
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  workoutLocation: "home" | "gym" | "outdoor";
  goalCategory: string;
  selectedDays?: string[]; // Selected days of the week
  startDate: string; // YYYY-MM-DD — plan start date
}

export interface AIGeneratedPlan {
  name: string;
  description: string;
  muscleGroups: string[];
  weeklySchedule: Record<string, DayWorkout | null>;
  weeks?: WeeksStructure;
  tips: string[];
}

// Calendar view types
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  weekNumber: number;
  workout?: DayWorkout;
  isRestDay: boolean;
  isCompleted: boolean;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
  planId: string;
}

// Week summary for overview
export interface WeekSummary {
  weekNumber: number;
  multiplier: number;
  isDeloadWeek: boolean;
  workoutDays: string[];
  isCurrentWeek: boolean;
  completionRate: number;
}

// Plan completion detection result
export interface PlanCompletionCheck {
  isComplete: boolean;
  overallCompletionRate: number; // 0-100
  weekCompletionRates: number[]; // per-week rates
  totalWorkoutDaysLogged: number;
  totalWorkoutDaysPlanned: number;
}

// Aggregated stats for a completed plan
export interface PlanCompletionStats {
  planName: string;
  durationWeeks: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  totalWorkoutsCompleted: number;
  totalWorkoutsPlanned: number;
  totalMinutes: number;
  totalCalories: number;
  totalExercisesCompleted: number;
  longestStreak: number;
  overallCompletionRate: number; // 0-100
  weeklyCompletionRates: number[]; // per-week
  startDate: string;
  endDate: string;
  totalXpEarned: number;
}

// Color mapping for workout types
export const WORKOUT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  push: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  pull: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  legs: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
  upper: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
  lower: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  "full body": { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  cardio: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
  rest: { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30" },
};

// Day of week labels
export const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const DAY_FULL_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
