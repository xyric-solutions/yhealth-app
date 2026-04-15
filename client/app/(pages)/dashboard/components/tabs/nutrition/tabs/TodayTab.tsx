"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  Flame,
  Beef,
  Wheat,
  Apple,
  Loader2,
} from "lucide-react";
import type { ClientMeal, WaterIntakeLog, ShoppingItem, MacroTarget } from "../types";
import { getFoodIcon } from "../constants";
import { formatTime } from "../utils";
import { WaterDetailCard } from "../../overview/widgets/WaterDetailCard";
import { ShoppingListWidget } from "../ShoppingListWidget";
import { ActivePlanWidget } from "../ActivePlanWidget";
import { AITipWidget } from "../AITipWidget";
import { MealSkeleton } from "../Skeletons";
import { DailyNutritionInsights } from "../DailyNutritionInsights";

interface TodayTabProps {
  meals: ClientMeal[];
  mealsLoading: boolean;
  macros: Record<string, MacroTarget>;
  activePlan: { name: string; targetCalories: number; targetProtein: number; mealsPerDay: number } | null | undefined;
  waterLog: WaterIntakeLog | null;
  waterLoading: boolean;
  waterUpdating: boolean;
  shoppingItems: ShoppingItem[];
  shoppingLoading: boolean;
  expandedMeal: string | null;
  onMealExpand: (mealId: string | null) => void;
  onAddMeal: () => void;
  onEditMeal: (meal: ClientMeal) => void;
  onDeleteMeal: (mealId: string) => void;
  onAddWater: () => void;
  onRemoveWater: () => void;
  onShoppingItemToggle: (itemId: string) => void;
  onShoppingItemEdit: (item: ShoppingItem) => void;
  onShoppingItemDelete: (itemId: string) => void;
  onShoppingAdd: () => void;
  onShoppingAIGenerate: () => void;
  onShoppingViewAll: () => void;
  onShoppingClearPurchased: () => void | Promise<void>;
}

export function TodayTab({
  meals,
  mealsLoading,
  macros,
  activePlan,
  waterLog,
  waterLoading,
  waterUpdating,
  shoppingItems,
  shoppingLoading,
  expandedMeal,
  onMealExpand,
  onAddMeal,
  onEditMeal,
  onDeleteMeal,
  onAddWater,
  onRemoveWater,
  onShoppingItemToggle,
  onShoppingItemEdit,
  onShoppingItemDelete,
  onShoppingAdd,
  onShoppingAIGenerate,
  onShoppingViewAll,
  onShoppingClearPurchased,
}: TodayTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid lg:grid-cols-3 gap-4 sm:gap-6"
    >
      {/* Meals List */}
      <div className="lg:col-span-2 min-w-0">
        <div className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] sm:text-[17px] font-bold text-white tracking-tight">Today&apos;s Meals</h3>
            <span className="text-[11px] text-slate-400 font-medium">{meals.length} logged</span>
          </div>

          {/* Today's Progress */}
          {(() => {
            const mealTarget = Math.max(1, activePlan?.mealsPerDay ?? 4);
            const mealsLogged = meals.length;
            const pct = Math.min(100, Math.round((mealsLogged / mealTarget) * 100));
            return (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Today&apos;s Progress</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">
                      <span className="text-white font-semibold">{mealsLogged}</span>
                      /{mealTarget} meals
                    </span>
                    <span className="text-emerald-300 font-semibold">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
                  />
                </div>
              </div>
            );
          })()}

        {mealsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <MealSkeleton key={i} />
            ))}
          </div>
        ) : meals.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] p-6 sm:p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4 flex items-center justify-center">
              <Utensils className="w-6 h-6 text-emerald-400/60" />
            </div>
            <h4 className="text-white font-semibold text-[15px] mb-1.5">No meals logged today</h4>
            <p className="text-slate-400 text-[13px] mb-5">Start tracking your nutrition by adding meals</p>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onAddMeal}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-[13px] hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25"
            >
              Add Your First Meal
            </motion.button>
          </div>
        ) : (
          <div className="space-y-2">
            {meals.map((meal, index) => {
              const isExpanded = expandedMeal === meal.id;
              const mealConsumed = (meal.items?.length ?? 0) > 0;
              return (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="group rounded-xl border border-white/[0.06] overflow-hidden transition-colors hover:border-white/[0.12] bg-white/[0.02]"
                >
                  <div
                    className="p-3 sm:p-3.5 cursor-pointer transition-colors hover:bg-white/[0.02]"
                    onClick={() => onMealExpand(isExpanded ? null : meal.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox (decorative — reflects all-items-eaten state) */}
                      <input
                        type="checkbox"
                        checked={mealConsumed}
                        readOnly
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 accent-emerald-600 text-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-0 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-[13px] sm:text-[14px] text-white truncate">{meal.name}</h4>
                          <span className="text-[10px] sm:text-[11px] text-slate-500 shrink-0 font-medium">{formatTime(meal.time)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-200">
                            <Flame className="w-3 h-3" />{meal.calories}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-200">
                            <Beef className="w-3 h-3" />{meal.protein}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-200">
                            <Wheat className="w-3 h-3" />{meal.carbs}g
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-200">
                            <Apple className="w-3 h-3" />{meal.fat}g
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMeal(meal);
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors"
                          title="Edit meal"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteMeal(meal.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete meal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="p-1"
                        >
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        </motion.span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 sm:px-4 pb-3 pt-1 border-t border-white/[0.04] space-y-2">
                          {/* Dashed Add Food Items slot */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditMeal(meal);
                            }}
                            className="w-full rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] hover:bg-emerald-500/[0.04] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-300 transition-all py-4 flex items-center justify-center gap-1.5 text-[12px] font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Food Items
                          </button>

                          {meal.items.length > 0 && (
                            <div className="space-y-1.5">
                              {meal.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                                >
                                  <span className="text-base sm:text-lg shrink-0">{getFoodIcon(item.name)}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-white truncate font-medium">{item.name}</p>
                                    <p className="text-[10px] sm:text-[11px] text-slate-500">{item.portion}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[12px] sm:text-[13px] text-orange-400 font-semibold">{item.calories} kcal</p>
                                    <p className="text-[10px] text-slate-500">
                                      P:{item.protein}g · C:{item.carbs}g · F:{item.fat}g
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Add More Meal — dashed footer */}
        <motion.button
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onClick={onAddMeal}
          className="mt-3 w-full p-3.5 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] hover:bg-emerald-500/[0.04] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-300 transition-all flex items-center justify-center gap-2 text-[13px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Add more meal
        </motion.button>
        </div>
      </div>

      {/* Side Panel */}
      <div className="space-y-4 min-w-0">
        {waterLoading ? (
          <div
            className="rounded-[28px] flex items-center justify-center min-h-[280px] border border-white/[0.06]"
            style={{
              background: "linear-gradient(148deg,#0a1422 0%,#070c1a 55%,#040810 100%)",
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400/60" aria-label="Loading water intake" />
          </div>
        ) : waterLog ? (
          <WaterDetailCard
            glasses={waterLog.glassesConsumed}
            targetGlasses={Math.max(waterLog.targetGlasses, 1)}
            mlConsumed={waterLog.mlConsumed}
            targetMl={waterLog.targetMl || 2000}
            onAddGlass={onAddWater}
            onRemoveGlass={onRemoveWater}
            isUpdating={waterUpdating}
          />
        ) : (
          <div
            className="rounded-[28px] border border-white/[0.06] p-8 text-center text-slate-400 text-sm"
            style={{
              background: "linear-gradient(148deg,#0a1422 0%,#070c1a 55%,#040810 100%)",
            }}
          >
            Unable to load water data
          </div>
        )}

        <ShoppingListWidget
          items={shoppingItems}
          isLoading={shoppingLoading}
          onToggleItem={onShoppingItemToggle}
          onEditItem={onShoppingItemEdit}
          onDeleteItem={onShoppingItemDelete}
          onAddItem={onShoppingAdd}
          onGenerateWithAI={onShoppingAIGenerate}
          onViewAll={onShoppingViewAll}
          onClearPurchased={onShoppingClearPurchased}
        />

        {activePlan && (
          <ActivePlanWidget
            plan={activePlan}
          />
        )}

        <DailyNutritionInsights />

        <AITipWidget macros={macros} />
      </div>
    </motion.div>
  );
}

