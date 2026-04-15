/**
 * @file Workouts API Service
 * @description Centralized API calls for workout-related operations
 */

import { api } from '@/lib/api-client';

// Types
export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  duration?: string;
  restSeconds?: number;
  completed: boolean;
  muscleGroup: string;
  instructions?: string[];
  tips?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  muscleGroups: string[];
  exercises: WorkoutExercise[];
  duration: number;
  scheduledTime?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isCustom: boolean;
  status?: string;
  currentDifficulty?: number;
  goalCategory?: string;
  durationWeeks?: number;
  workoutsPerWeek?: number;
  availableEquipment?: string[];
  workoutLocation?: string;
  weeklySchedule?: Record<string, unknown>;
}

// Exercise set completion data (server format)
export interface ExerciseSetCompletion {
  reps: number;
  weight?: number;
  completed: boolean;
}

// Exercise completion data for logging (server format)
export interface ExerciseCompletion {
  exerciseId: string;
  sets: ExerciseSetCompletion[];
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  workoutPlanId?: string;
  scheduledDate: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  workoutName?: string;
  exercisesCompleted: ExerciseCompletion[];
  totalSets?: number;
  totalReps?: number;
  totalVolume?: number;
  durationMinutes?: number;
  difficultyRating?: number;
  energyLevel?: number;
  moodAfter?: string;
  notes?: string;
  xpEarned?: number;
}

export interface TodaysWorkout {
  dayOfWeek: number;
  dayName: string;
  workout: {
    name: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      restSeconds: number;
      muscleGroups: string[];
    }[];
  } | null;
  isRestDay: boolean;
}

// Response Types
export interface WorkoutPlansResponse {
  plans: WorkoutPlan[];
}

export interface WorkoutLogResponse {
  log: WorkoutLog;
  xpEarned?: number;
}

export interface WorkoutLogsResponse {
  logs: WorkoutLog[];
}

// Weekly workout stats
export interface WorkoutWeeklyStats {
  weeklyWorkouts: number;
  weeklyGoal: number;
  totalMinutes: number;
  caloriesBurned: number;
  currentStreak: number;
}

// Personal record
export interface PersonalRecord {
  exerciseName: string;
  weight: number;
  reps: number;
  improvement: number;
  date: string;
}

// Weekly schedule day
export interface WeeklyScheduleDay {
  day: string;
  dayName: string;
  name: string;
  completed: boolean;
  isToday: boolean;
  isRest: boolean;
  scheduledTime?: string;
  planId?: string;
}

// Create workout plan input
export interface CreateWorkoutPlanInput {
  name: string;
  description?: string;
  goalCategory?: string;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks?: number;
  workoutsPerWeek?: number;
  scheduledTime?: string;
  availableEquipment?: string[];
  workoutLocation?: string;
  muscleGroups?: string[];
  exercises?: WorkoutExercise[];
  weeklySchedule?: Record<string, unknown>;
  isActive?: boolean;
  startDate?: string; // YYYY-MM-DD — defaults to today on server
}

// Update workout plan input
export interface UpdateWorkoutPlanInput {
  name?: string;
  description?: string;
  goalCategory?: string;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks?: number;
  workoutsPerWeek?: number;
  scheduledTime?: string;
  weeklySchedule?: Record<string, unknown>;
  availableEquipment?: string[];
  workoutLocation?: string;
  status?: string;
  muscleGroups?: string[];
  exercises?: Array<{
    id?: string;
    name: string;
    sets: number;
    reps: string;
    weight?: string;
    duration?: number;
    restSeconds?: number;
    muscleGroup?: string;
  }>;
}

// AI exercise suggestion input
export interface SuggestExercisesInput {
  muscleGroups?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  equipment?: string[];
  duration?: number;
  goalCategory?: string;
}

// AI exercise suggestion response
export interface SuggestedExercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  muscleGroup: string;
  instructions?: string[];
  tips?: string;
}

// AI generate plan input
export interface GenerateAIPlanInput {
  description: string;
  goalCategory?: string;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks?: number;
  workoutsPerWeek?: number;
  equipment?: string[];
  workoutLocation?: string;
  timePerWorkout?: number;
  startDate?: string; // YYYY-MM-DD — defaults to today on server
}

/**
 * Workouts Service - handles all workout API operations
 */
export const workoutsService = {
  /**
   * Get all user's workout plans
   */
  getPlans: () =>
    api.get<WorkoutPlansResponse>('/workouts/plans'),

  /**
   * Get a specific workout plan
   */
  getPlan: (planId: string) =>
    api.get<{ plan: WorkoutPlan }>(`/workouts/plans/${planId}`),

  /**
   * Create a new workout plan manually
   */
  createPlan: (data: CreateWorkoutPlanInput) =>
    api.post<{ plan: WorkoutPlan }>('/workouts/plans', data),

  /**
   * Update an existing workout plan
   */
  updatePlan: (planId: string, data: UpdateWorkoutPlanInput) =>
    api.patch<{ plan: WorkoutPlan }>(`/workouts/plans/${planId}`, data),

  /**
   * Delete a workout plan
   */
  deletePlan: (planId: string) =>
    api.delete<{ message: string }>(`/workouts/plans/${planId}`),

  /**
   * Activate a workout plan (deactivates others)
   */
  activatePlan: (planId: string) =>
    api.post<{ plan: WorkoutPlan }>(`/workouts/plans/${planId}/activate`),

  /**
   * Generate a new AI workout plan (legacy - uses service)
   */
  generatePlan: (data: {
    planId?: string;
    goalCategory?: string;
    durationWeeks?: number;
    workoutsPerWeek?: number;
    timePerWorkout?: number;
    fitnessLevel?: string;
    availableEquipment?: string[];
    workoutLocation?: string;
    focusAreas?: string[];
  }) =>
    api.post<{ plan: WorkoutPlan }>('/workouts/plans/generate', data),

  /**
   * Generate a complete workout plan using AI with description
   */
  generateAIPlan: (data: GenerateAIPlanInput) =>
    api.post<{ plan: WorkoutPlan; tips: string[]; provider: string }>('/workouts/plans/generate-ai', data),

  /**
   * Get AI-suggested exercises based on criteria
   */
  suggestExercises: (data: SuggestExercisesInput) =>
    api.post<{ exercises: SuggestedExercise[]; workoutTips: string[]; provider: string }>('/workouts/exercises/suggest', data),

  /**
   * Get today's scheduled workout
   */
  getTodaysWorkout: (planId: string) =>
    api.get<{ workout: TodaysWorkout }>(`/workouts/today?planId=${planId}`),

  /**
   * Log a completed workout
   */
  logWorkout: (data: {
    workoutPlanId?: string;
    scheduledDate?: string;
    workoutName?: string;
    exercisesCompleted: ExerciseCompletion[];
    durationMinutes?: number;
    difficultyRating?: number;
    energyLevel?: number;
    moodAfter?: string;
    notes?: string;
  }) =>
    api.post<WorkoutLogResponse>('/workouts/logs', data),

  /**
   * Get workout logs for a specific date
   */
  getLogsForDate: (date: string) =>
    api.get<WorkoutLogsResponse>(`/workouts/logs/${date}`),

  /**
   * Get workout logs for a date range (for calendar view)
   */
  getLogsByDateRange: (startDate: string, endDate: string, planId?: string) => {
    const params = new URLSearchParams({ startDate, endDate });
    if (planId) params.append('planId', planId);
    return api.get<WorkoutLogsResponse>(`/workouts/logs/range?${params.toString()}`);
  },

  /**
   * Adjust workout plan difficulty
   */
  adjustDifficulty: (planId: string, data: {
    completionRate: number;
    averageRating: number;
    workoutsCompleted: number;
  }) =>
    api.patch<{ newDifficulty: number; message: string }>(`/workouts/plans/${planId}/difficulty`, data),

  /**
   * Get exercise library
   */
  getExercises: (filters?: {
    category?: string;
    difficulty?: string;
    muscleGroup?: string;
    equipment?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.muscleGroup) params.append('muscleGroup', filters.muscleGroup);
    if (filters?.equipment) params.append('equipment', filters.equipment);

    const queryString = params.toString();
    return api.get<{ exercises: unknown[] }>(`/workouts/exercises${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get weekly workout stats
   * Calculates from workout logs for the current week
   */
  getWeeklyStats: () =>
    api.get<{ stats: WorkoutWeeklyStats }>('/workouts/stats/weekly'),

  /**
   * Get personal records
   * Returns top PRs from workout history
   */
  getPersonalRecords: (limit?: number) =>
    api.get<{ records: PersonalRecord[] }>(`/workouts/stats/prs${limit ? `?limit=${limit}` : ''}`),

  /**
   * Get weekly schedule derived from active workout plan
   */
  getWeeklySchedule: (planId?: string) =>
    api.get<{ schedule: WeeklyScheduleDay[] }>(`/workouts/schedule/weekly${planId ? `?planId=${planId}` : ''}`),
};
