/**
 * @file Nutrition Utils
 * Utility functions for nutrition components
 */

import { DietPlan, MealLog } from "@/src/shared/services";
import { ClientDietPlan, ClientMeal } from "./types";

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Format time from 24h to 12h format
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHours = h % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Transform API diet plan to client format
 */
export function transformApiPlanToClient(plan: DietPlan): ClientDietPlan {
  return {
    id: plan.id,
    name: plan.name,
    type: plan.goalCategory || 'balanced',
    targetCalories: plan.dailyCalories || 2000,
    targetProtein: plan.proteinGrams || 120,
    targetCarbs: plan.carbsGrams || 200,
    targetFat: plan.fatGrams || 65,
    mealsPerDay: plan.mealsPerDay || 3,
    createdAt: plan.createdAt.split('T')[0],
    isActive: plan.status === 'active',
    description: plan.description || undefined,
  };
}

/**
 * Transform API meal to client format
 */
export function transformApiMealToClient(meal: MealLog): ClientMeal {
  const mealTypeToIcon: Record<string, "breakfast" | "lunch" | "dinner" | "snack"> = {
    breakfast: "breakfast",
    lunch: "lunch",
    dinner: "dinner",
    snack: "snack",
  };
  const eatenAt = new Date(meal.eatenAt);
  // Use local time (hours and minutes) for display
  const hours = eatenAt.getHours().toString().padStart(2, '0');
  const minutes = eatenAt.getMinutes().toString().padStart(2, '0');
  const time = `${hours}:${minutes}`;

  return {
    id: meal.id,
    name: meal.mealName || meal.mealType,
    time,
    calories: meal.calories || 0,
    protein: meal.proteinGrams || 0,
    carbs: meal.carbsGrams || 0,
    fat: meal.fatGrams || 0,
    items: meal.foods || [],
    completed: true,
    icon: mealTypeToIcon[meal.mealType] || "snack",
    mealType: meal.mealType,
  };
}

/**
 * Calculate macro percentages
 */
export function calculateMacroPercentage(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Get macro color based on percentage
 */
export function getMacroColor(percentage: number): string {
  if (percentage >= 100) return 'text-emerald-400';
  if (percentage >= 75) return 'text-amber-400';
  return 'text-slate-400';
}

/**
 * Calculate total macros from meals
 */
export function calculateTotalMacros(meals: ClientMeal[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.calories,
    protein: acc.protein + meal.protein,
    carbs: acc.carbs + meal.carbs,
    fat: acc.fat + meal.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

/**
 * Get current meal time suggestion
 */
export function getSuggestedMealType(): "breakfast" | "lunch" | "dinner" | "snack" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 21) return "dinner";
  return "snack";
}

/**
 * Get current time in HH:mm format
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Calculate water progress percentage
 */
export function calculateWaterProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Get meal icon name based on time
 */
export function getMealIconByTime(time: string): "breakfast" | "lunch" | "dinner" | "snack" {
  const [hours] = time.split(":").map(Number);
  if (hours >= 5 && hours < 11) return "breakfast";
  if (hours >= 11 && hours < 15) return "lunch";
  if (hours >= 17 && hours < 21) return "dinner";
  return "snack";
}
