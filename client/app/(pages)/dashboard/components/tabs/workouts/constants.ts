/**
 * @file Workout Constants
 * Shared constants for workout components
 */

import type { WorkoutStats } from './types';

// Motivational quotes for workout sessions
export const MOTIVATIONAL_QUOTES = [
  "Push yourself, because no one else is going to do it for you! 💪",
  "Success starts with self-discipline. Keep going! 🔥",
  "The only bad workout is the one that didn't happen! 🏋️",
  "Your body can stand almost anything. It's your mind you have to convince! 🧠",
  "Sweat is just fat crying. Make it weep! 💦",
  "Every rep counts. Every set matters. You've got this! ⚡",
  "Pain is temporary, pride is forever! 🏆",
  "You're stronger than you think! 💪",
  "Champions train, losers complain! 🌟",
  "One more rep! You can do it! 🎯",
];

// Preset exercises by muscle group
export const PRESET_EXERCISES: Record<string, string[]> = {
  Chest: ["Bench Press", "Incline Dumbbell Press", "Cable Flyes", "Push-Ups", "Dips"],
  Back: ["Pull-Ups", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "Deadlift"],
  Shoulders: ["Shoulder Press", "Lateral Raises", "Front Raises", "Face Pulls", "Arnold Press"],
  Legs: ["Squat", "Leg Press", "Lunges", "Leg Curl", "Calf Raises", "Romanian Deadlift"],
  Arms: ["Bicep Curls", "Tricep Dips", "Hammer Curls", "Skull Crushers", "Cable Curls"],
  Core: ["Planks", "Crunches", "Leg Raises", "Russian Twists", "Ab Wheel"],
  Cardio: ["Treadmill", "Cycling", "Rowing", "Jump Rope", "Elliptical"],
};

export const MUSCLE_GROUPS = Object.keys(PRESET_EXERCISES);

export const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner", color: "text-emerald-400" },
  { value: "intermediate", label: "Intermediate", color: "text-amber-400" },
  { value: "advanced", label: "Advanced", color: "text-red-400" },
] as const;

// Default stats when no data available
export const DEFAULT_WORKOUT_STATS: WorkoutStats = {
  weeklyWorkouts: 0,
  weeklyGoal: 5,
  totalMinutes: 0,
  caloriesBurned: 0,
  currentStreak: 0,
};

// Default equipment options
export const DEFAULT_EQUIPMENT = ['bodyweight', 'dumbbells', 'barbell'];

// All equipment options for AI generation
export const EQUIPMENT_OPTIONS = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'resistance_bands', label: 'Resistance Bands' },
  { value: 'cable_machine', label: 'Cable Machine' },
  { value: 'pull_up_bar', label: 'Pull-up Bar' },
  { value: 'bench', label: 'Bench' },
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'stationary_bike', label: 'Stationary Bike' },
];

// Workout location options
export const LOCATION_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
  { value: 'outdoor', label: 'Outdoor' },
] as const;

// Goal category options
export const GOAL_CATEGORY_OPTIONS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_building', label: 'Muscle Building' },
  { value: 'strength', label: 'Strength' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'overall_optimization', label: 'Overall Fitness' },
] as const;

// Duration weeks options
export const DURATION_OPTIONS = [
  { value: 1, label: '1 Week' },
  { value: 2, label: '2 Weeks' },
  { value: 4, label: '4 Weeks' },
  { value: 8, label: '8 Weeks' },
  { value: 12, label: '12 Weeks' },
] as const;

// Workouts per week options
export const WORKOUTS_PER_WEEK_OPTIONS = [
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 4, label: '4 days' },
  { value: 5, label: '5 days' },
  { value: 6, label: '6 days' },
] as const;

// Time per workout options (minutes)
export const TIME_PER_WORKOUT_OPTIONS = [
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
] as const;

// Days of week for schedule display
export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const DAYS_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
