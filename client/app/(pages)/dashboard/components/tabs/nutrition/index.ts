/**
 * @file Nutrition Components Index
 * Export all nutrition-related components
 */

// ============================================
// UI COMPONENTS
// ============================================

// Macro Overview
export { MacroOverview } from './MacroOverview';

// Meals
export { MealCard } from './MealCard';
export { MealsList } from './MealsList';

// Water Tracker
export { WaterTracker } from './WaterTracker';

// Shopping List
export { ShoppingListWidget } from './ShoppingListWidget';

// Diet Plans
export { DietPlanCard } from './DietPlanCard';
export { DietPlansList } from './DietPlansList';

// Recipes
export { RecipeCard } from './RecipeCard';
export { RecipesList } from './RecipesList';

// Sidebar Widgets
export { ActivePlanWidget } from './ActivePlanWidget';
export { AITipWidget } from './AITipWidget';

// View Toggle
export { ViewToggle } from './ViewToggle';
export type { ViewType } from './ViewToggle';

// Skeleton Components
export {
  DietPlanSkeleton,
  MealSkeleton,
  RecipeSkeleton,
  MacroCardSkeleton,
  WaterWidgetSkeleton,
  ShoppingItemSkeleton,
} from './Skeletons';

// ============================================
// TYPES
// ============================================

export type {
  MacroTarget,
  WaterIntakeLog,
  ShoppingItem,
  ClientMeal,
  ClientDietPlan,
  MealFormData,
  DietPlanFormData,
  RecipeFormData,
  ShoppingFormData,
  NutritionStats,
} from './types';

// ============================================
// CONSTANTS
// ============================================

export {
  PRESET_FOODS,
  FOOD_CATEGORIES,
  MEAL_ICONS,
  MEAL_ICONS_LIST,
  MACRO_COLORS,
  DIET_TYPES,
  SHOPPING_CATEGORIES,
  RECIPE_CATEGORIES,
  DIFFICULTY_LEVELS,
  DIETARY_FLAGS,
  DEFAULT_NUTRITION_STATS,
  DEFAULT_MACRO_TARGETS,
} from './constants';

// ============================================
// UTILITIES
// ============================================

export {
  isValidUUID,
  formatTime,
  formatDate,
  transformApiPlanToClient,
  transformApiMealToClient,
  calculateMacroPercentage,
  getMacroColor,
  calculateTotalMacros,
  getSuggestedMealType,
  getCurrentTime,
  calculateWaterProgress,
  getMealIconByTime,
} from './utils';

// Logger
export { nutritionLogger } from './logger';
