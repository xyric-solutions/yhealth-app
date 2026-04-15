/**
 * @file Nutrition API Service
 * @description Centralized API calls for diet plans and meal logging operations
 */

import { api } from '@/lib/api-client';

// Types
export interface DietPlan {
  id: string;
  userId: string;
  planId: string | null;
  name: string;
  description: string | null;
  goalCategory: string;
  dailyCalories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  dietaryPreferences: string[];
  allergies: string[];
  excludedFoods: string[];
  mealsPerDay: number;
  snacksPerDay: number;
  mealTimes: Record<string, string>;
  weeklyMeals: Record<string, unknown>;
  suggestedRecipes: unknown[];
  shoppingList: unknown[];
  adherenceRate: number;
  status: string;
  startDate: string;
  endDate: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: string;
  // Optional micro-nutrients
  fiber?: number;
  vitamins?: {
    vitaminA?: number; // IU
    vitaminC?: number; // mg
    vitaminD?: number; // IU
    vitaminE?: number; // mg
    vitaminK?: number; // mcg
    thiamin?: number; // mg (B1)
    riboflavin?: number; // mg (B2)
    niacin?: number; // mg (B3)
    vitaminB6?: number; // mg
    folate?: number; // mcg (B9)
    vitaminB12?: number; // mcg
    biotin?: number; // mcg (B7)
    pantothenicAcid?: number; // mg (B5)
  };
  minerals?: {
    calcium?: number; // mg
    iron?: number; // mg
    magnesium?: number; // mg
    phosphorus?: number; // mg
    potassium?: number; // mg
    sodium?: number; // mg
    zinc?: number; // mg
    copper?: number; // mg
    manganese?: number; // mg
    selenium?: number; // mcg
    chromium?: number; // mcg
    molybdenum?: number; // mcg
  };
}

export interface MealLog {
  id: string;
  userId: string;
  dietPlanId: string | null;
  mealType: string;
  mealName: string | null;
  description: string | null;
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  foods: MealFood[];
  photoUrl: string | null;
  eatenAt: string;
  hungerBefore: number | null;
  satisfactionAfter: number | null;
  notes: string | null;
  aiFeedback: string | null;
  healthScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDietPlanInput {
  name: string;
  description?: string;
  goalCategory?: string;
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  dietaryPreferences?: string[];
  allergies?: string[];
  excludedFoods?: string[];
  mealsPerDay?: number;
  snacksPerDay?: number;
  mealTimes?: Record<string, string>;
  weeklyMeals?: Record<string, unknown>;
  suggestedRecipes?: unknown[];
  isActive?: boolean;
}

export interface UpdateDietPlanInput {
  name?: string;
  description?: string;
  goalCategory?: string;
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  dietaryPreferences?: string[];
  allergies?: string[];
  excludedFoods?: string[];
  mealsPerDay?: number;
  snacksPerDay?: number;
  mealTimes?: Record<string, string>;
  weeklyMeals?: Record<string, unknown>;
  suggestedRecipes?: unknown[];
  status?: string;
  endDate?: string;
}

export interface CreateMealLogInput {
  dietPlanId?: string;
  mealType: string;
  mealName?: string;
  description?: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  foods?: MealFood[];
  photoUrl?: string;
  eatenAt?: string;
  hungerBefore?: number;
  satisfactionAfter?: number;
  notes?: string;
}

export interface UpdateMealLogInput {
  mealType?: string;
  mealName?: string;
  description?: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  foods?: MealFood[];
  photoUrl?: string;
  eatenAt?: string;
  hungerBefore?: number;
  satisfactionAfter?: number;
  notes?: string;
}

// Recipe types
export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface RecipeInstruction {
  step: number;
  description: string;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  servings: number;
  caloriesPerServing: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  tags: string[];
  dietaryFlags: string[];
  imageUrl: string | null;
  difficulty: string;
  rating: number | null;
  timesMade: number;
  isFavorite: boolean;
  source: string;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecipeInput {
  name: string;
  description?: string;
  category?: string;
  cuisine?: string;
  servings?: number;
  caloriesPerServing?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  ingredients?: RecipeIngredient[];
  instructions?: RecipeInstruction[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  tags?: string[];
  dietaryFlags?: string[];
  imageUrl?: string;
  difficulty?: string;
  source?: string;
  sourceUrl?: string;
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  category?: string;
  cuisine?: string;
  servings?: number;
  caloriesPerServing?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  ingredients?: RecipeIngredient[];
  instructions?: RecipeInstruction[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  tags?: string[];
  dietaryFlags?: string[];
  imageUrl?: string;
  difficulty?: string;
  rating?: number;
  timesMade?: number;
  isFavorite?: boolean;
}

// Response types
export interface DietPlansResponse {
  plans: DietPlan[];
  total: number;
}

export interface DietPlanResponse {
  plan: DietPlan;
}

export interface MealLogsResponse {
  meals: MealLog[];
  total: number;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MealLogResponse {
  meal: MealLog;
}

export interface RecipesResponse {
  recipes: Recipe[];
  total: number;
}

export interface RecipeResponse {
  recipe: Recipe;
}

// AI Generation response types
export interface AIGeneratePlanResponse {
  plan: DietPlan;
  tips: string[];
  provider: string;
}

export interface AIGenerateMealResponse {
  meal: MealLog;
  preparationTips: string;
  provider: string;
}

export interface AIGenerateRecipeResponse {
  recipe: Recipe;
  tips: string;
  provider: string;
}

// AI Generation input types
export interface AIGeneratePlanInput {
  description: string;
  goalCategory?: string;
  dailyCalories?: number;
  dietaryPreferences?: string[];
  allergies?: string[];
}

export interface AIGenerateMealInput {
  description: string;
  mealType?: string;
  targetCalories?: number;
  dietaryPreferences?: string[];
}

export interface AIGenerateRecipeInput {
  description: string;
  category?: string;
  servings?: number;
  dietaryPreferences?: string[];
  difficulty?: string;
}

// ============================================
// ADAPTIVE NUTRITION TYPES
// ============================================

export type DeviationClassification =
  | 'on_target'
  | 'minor_under'
  | 'significant_under'
  | 'severe_under'
  | 'minor_over'
  | 'significant_over'
  | 'severe_over'
  | 'missed_day';

export type AdjustmentType = 'next_day' | 'redistribute' | 'gradual' | 'skip';
export type AdjustmentStatus = 'proposed' | 'accepted' | 'active' | 'completed' | 'skipped' | 'expired';
export type UserChoice = 'accept' | 'modify' | 'skip';

export interface MealLogSummary {
  id: string;
  mealType: string;
  mealName: string | null;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  eatenAt: string;
}

export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
  mealsLogged: MealLogSummary[];
}

export interface NutritionTargets {
  calories: number;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  dietPlanId: string | null;
  dietPlanName: string | null;
}

export interface WhoopDayContext {
  workoutCalories: number;
  recoveryScore: number | null;
  strainScore: number | null;
  hasWorkout: boolean;
  workoutCount: number;
}

export interface DeviationAnalysis {
  calorieDeviation: number;
  deviationPercent: number;
  classification: DeviationClassification;
  proteinDeviation: number | null;
  carbsDeviation: number | null;
  fatDeviation: number | null;
}

export interface AIRecommendation {
  type: 'adjustment' | 'insight' | 'encouragement' | 'warning';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DailyAnalysis {
  id: string;
  userId: string;
  date: string;
  summary: DailyNutritionSummary;
  targets: NutritionTargets;
  deviation: DeviationAnalysis;
  whoopContext: WhoopDayContext;
  aiAnalysis: string | null;
  aiRecommendations: AIRecommendation[];
  status: string;
  deviationReason: string | null;
  userNotes: string | null;
}

export interface SafetyWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface RedistributionPlan {
  [date: string]: number;
}

export interface AdjustmentRecord {
  id: string;
  userId: string;
  analysisId: string;
  dietPlanId: string | null;
  type: AdjustmentType;
  calorieDeficit: number;
  originalDeficit: number;
  redistributionDays: number;
  dailyAdjustment: number;
  redistributionPlan: RedistributionPlan;
  skippedCalories: number;
  skipReason: string | null;
  userChoice: UserChoice | null;
  safetyApproved: boolean;
  safetyWarnings: SafetyWarning[];
  coachingMessage: string;
  status: AdjustmentStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface AdjustedTargets {
  baseCalories: number;
  adjustedCalories: number;
  adjustmentAmount: number;
  adjustmentReason: string;
  activeAdjustments: AdjustmentRecord[];
  workoutCalorieAdjustment: number;
}

export interface DayPattern {
  dayOfWeek: string;
  dayIndex: number;
  avgDeviation: number;
  avgDeviationPercent: number;
  successRate: number;
  observations: number;
}

export interface AdherencePattern {
  id: string;
  patternType: string;
  patternKey: string;
  occurrences: number;
  successRate: number;
  averageDeviationPercent: number;
  aiInsight: string | null;
  recommendation: string | null;
  confidenceScore: number;
  isValid: boolean;
}

export interface PatternAnalysis {
  userId: string;
  analyzedDays: number;
  patterns: AdherencePattern[];
  strengths: string[];
  challenges: string[];
  recommendations: string[];
}

export interface NutritionUserPreferences {
  analysisTime: string;
  analysisEnabled: boolean;
  autoAdjustEnabled: boolean;
  maxDailyAdjustmentCalories: number;
  maxRedistributionDays: number;
  preferNextDayAdjustment: boolean;
  adjustmentStrategy: 'aggressive' | 'balanced' | 'conservative';
  notifyOnDeviation: boolean;
  deviationThresholdPercent: number;
  factorWorkoutCalories: boolean;
  workoutCalorieAddbackPercent: number;
  skipIfRecoveryBelow: number;
  increaseCarbsOnHighStrain: boolean;
}

/**
 * Nutrition Service - handles all diet plans, meal logging, and AI generation API operations
 */
export const nutritionService = {
  // ============================================
  // AI GENERATION
  // ============================================

  /**
   * Generate a diet plan using AI
   */
  generatePlanWithAI: (data: AIGeneratePlanInput) =>
    api.post<AIGeneratePlanResponse>('/diet-plans/generate', data),

  /**
   * Generate a meal using AI
   */
  generateMealWithAI: (data: AIGenerateMealInput) =>
    api.post<AIGenerateMealResponse>('/diet-plans/meals/generate', data),

  /**
   * Generate a recipe using AI
   */
  generateRecipeWithAI: (data: AIGenerateRecipeInput) =>
    api.post<AIGenerateRecipeResponse>('/diet-plans/recipes/generate', data),

  // ============================================
  // DIET PLANS
  // ============================================

  /**
   * Get all diet plans for the user
   */
  getPlans: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return api.get<DietPlansResponse>(`/diet-plans${params}`);
  },

  /**
   * Get a specific diet plan
   */
  getPlan: (planId: string) =>
    api.get<DietPlanResponse>(`/diet-plans/${planId}`),

  /**
   * Create a new diet plan
   */
  createPlan: (data: CreateDietPlanInput) =>
    api.post<DietPlanResponse>('/diet-plans', data),

  /**
   * Update an existing diet plan
   */
  updatePlan: (planId: string, data: UpdateDietPlanInput) =>
    api.patch<DietPlanResponse>(`/diet-plans/${planId}`, data),

  /**
   * Activate a diet plan (sets as active, deactivates others)
   */
  activatePlan: (planId: string) =>
    api.patch<DietPlanResponse>(`/diet-plans/${planId}/activate`, {}),

  /**
   * Delete a diet plan
   */
  deletePlan: (planId: string) =>
    api.delete(`/diet-plans/${planId}`),

  /**
   * Delete multiple diet plans
   */
  deletePlans: (ids: string[]) =>
    api.delete<{ deletedCount: number }>('/diet-plans', { ids }),

  // ============================================
  // MEAL LOGS
  // ============================================

  /**
   * Get meal logs for a date or date range
   */
  getMeals: (options?: { date?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (options?.date) params.append('date', options.date);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    // Send user timezone so server filters by local date, not UTC
    try { params.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* fallback to UTC on server */ }
    const queryString = params.toString();
    return api.get<MealLogsResponse>(`/diet-plans/meals${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Log a meal
   */
  logMeal: (data: CreateMealLogInput) =>
    api.post<MealLogResponse>('/diet-plans/meals', data),

  /**
   * Update a meal log
   */
  updateMeal: (mealId: string, data: UpdateMealLogInput) =>
    api.patch<MealLogResponse>(`/diet-plans/meals/${mealId}`, data),

  /**
   * Delete a meal log
   */
  deleteMeal: (mealId: string) =>
    api.delete(`/diet-plans/meals/${mealId}`),

  // ============================================
  // RECIPES
  // ============================================

  /**
   * Get all recipes for the user
   */
  getRecipes: (options?: { category?: string; favorite?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.favorite) params.append('favorite', 'true');
    const queryString = params.toString();
    return api.get<RecipesResponse>(`/diet-plans/recipes${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a specific recipe
   */
  getRecipe: (recipeId: string) =>
    api.get<RecipeResponse>(`/diet-plans/recipes/${recipeId}`),

  /**
   * Create a new recipe
   */
  createRecipe: (data: CreateRecipeInput) =>
    api.post<RecipeResponse>('/diet-plans/recipes', data),

  /**
   * Update a recipe
   */
  updateRecipe: (recipeId: string, data: UpdateRecipeInput) =>
    api.patch<RecipeResponse>(`/diet-plans/recipes/${recipeId}`, data),

  /**
   * Delete a recipe
   */
  deleteRecipe: (recipeId: string) =>
    api.delete(`/diet-plans/recipes/${recipeId}`),

  /**
   * Delete multiple recipes
   */
  deleteRecipes: (ids: string[]) =>
    api.delete<{ deletedCount: number }>('/diet-plans/recipes', { ids }),

  /**
   * Toggle recipe favorite status
   */
  toggleRecipeFavorite: (recipeId: string) =>
    api.patch<RecipeResponse>(`/diet-plans/recipes/${recipeId}/favorite`, {}),

  /**
   * Upload a recipe image to R2 and return its public URL.
   * Reuses the generic POST /api/upload/image endpoint, which uploads the buffer
   * and returns { key, url, publicUrl, ... }. We prefer publicUrl (non-expiring)
   * when present, falling back to url.
   */
  uploadRecipeImage: async (file: File): Promise<{ imageUrl: string; key: string }> => {
    const form = new FormData();
    form.append("file", file);
    const resp = await api.upload<{
      key: string;
      encodedKey: string;
      url: string;
      publicUrl?: string;
      size: number;
      mimeType: string;
      originalName: string;
    }>("/upload/image", form);
    const data = resp.data;
    if (!data) {
      throw new Error("Image upload failed: empty response");
    }
    return { imageUrl: data.publicUrl || data.url, key: data.key };
  },

  // ============================================
  // ADAPTIVE NUTRITION
  // ============================================

  /**
   * Get daily analysis for a specific date
   */
  getDailyAnalysis: (date: string) =>
    api.get<{ analysis: DailyAnalysis }>(`/nutrition/daily-analysis/${date}`),

  /**
   * Get analysis history
   */
  getAnalysisHistory: (options?: { startDate?: string; endDate?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.limit) params.append('limit', options.limit.toString());
    const queryString = params.toString();
    return api.get<{ analyses: DailyAnalysis[] }>(`/nutrition/analysis-history${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Update deviation feedback
   */
  updateDeviationFeedback: (analysisId: string, data: { reason: string; notes?: string }) =>
    api.patch<{ success: boolean }>(`/nutrition/daily-analysis/${analysisId}/feedback`, data),

  /**
   * Trigger manual analysis (for testing)
   */
  triggerAnalysis: (date?: string) =>
    api.post<{ success: boolean; analysis: DailyAnalysis }>('/nutrition/trigger-analysis', { date }),

  /**
   * Get today's adjusted targets
   */
  getAdaptivePlan: () =>
    api.get<AdjustedTargets>('/nutrition/adaptive-plan'),

  /**
   * Get pending adjustment proposals
   */
  getPendingAdjustments: () =>
    api.get<{ adjustments: AdjustmentRecord[] }>('/nutrition/pending-adjustments'),

  /**
   * Submit adjustment response
   */
  submitAdjustmentResponse: (data: {
    adjustmentId: string;
    choice: UserChoice;
    modifications?: RedistributionPlan;
  }) => api.post<{ success: boolean; message: string }>('/nutrition/adjustment-response', data),

  /**
   * Get behavioral insights and patterns
   */
  getInsights: (days?: number) => {
    const params = days ? `?days=${days}` : '';
    return api.get<PatternAnalysis>(`/nutrition/insights${params}`);
  },

  /**
   * Get day-of-week patterns
   */
  getDayPatterns: () =>
    api.get<{ patterns: DayPattern[] }>('/nutrition/day-patterns'),

  /**
   * Get user nutrition preferences
   */
  getNutritionPreferences: () =>
    api.get<NutritionUserPreferences>('/nutrition/preferences'),

  /**
   * Update user nutrition preferences
   */
  updateNutritionPreferences: (data: Partial<NutritionUserPreferences>) =>
    api.patch<{ success: boolean; preferences: NutritionUserPreferences }>('/nutrition/preferences', data),
};
