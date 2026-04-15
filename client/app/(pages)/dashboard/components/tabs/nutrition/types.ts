/**
 * @file Nutrition Types
 * Shared types for nutrition components
 */

import { MealFood, RecipeIngredient, RecipeInstruction } from "@/src/shared/services";

export interface MacroTarget {
  current: number;
  target: number;
  unit: string;
}

export interface WaterIntakeLog {
  id: string;
  glassesConsumed: number;
  targetGlasses: number;
  mlConsumed: number;
  targetMl: number;
  goalAchieved: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  notes: string | null;
  source: "manual" | "ai_generated" | "diet_plan";
  isPurchased: boolean;
  priority: number;
  calories?: number | null; // Optional calories per item
}

// Client-side types for UI
export interface ClientMeal {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: MealFood[];
  completed: boolean;
  icon: "breakfast" | "lunch" | "dinner" | "snack";
  mealType: string;
}

export interface ClientDietPlan {
  id: string;
  name: string;
  type: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  mealsPerDay: number;
  createdAt: string;
  isActive: boolean;
  description?: string;
}

export interface MealFormData {
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  time: string;
  foods: MealFood[];
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  manualMacros?: boolean;
}

export interface DietPlanFormData {
  name: string;
  type: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  mealsPerDay: number;
  description: string;
  useAI: boolean;
  aiPrompt: string;
}

export interface RecipeFormData {
  name: string;
  description: string;
  category: string;
  cuisine: string;
  servings: number;
  caloriesPerServing: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  difficulty: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  tags: string[];
  dietaryFlags: string[];
  imageUrl?: string | null;
}

export interface ShoppingFormData {
  name: string;
  quantity: string;
  category: string;
  notes: string;
}

export interface NutritionStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealsLogged: number;
  waterGlasses: number;
}

export interface NutritionLabelData {
  productName: string | null;
  servingSize: string | null;
  servingsPerContainer: number | null;
  nutrients: {
    calories: number | null;
    totalFat: number | null;
    saturatedFat: number | null;
    transFat: number | null;
    cholesterol: number | null;
    sodium: number | null;
    totalCarbs: number | null;
    dietaryFiber: number | null;
    totalSugars: number | null;
    protein: number | null;
  };
}

export interface FoodAnalysisResult {
  foodsIdentified: Array<{
    name: string;
    portion: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  }>;
  caloriesEstimate: string;
  macronutrients: {
    protein: number;
    carbs: number;
    fats: number;
    fiber?: number;
  };
  micronutrients: string[];
  nutritionSuggestions: string[];
  analysis: string;
}
