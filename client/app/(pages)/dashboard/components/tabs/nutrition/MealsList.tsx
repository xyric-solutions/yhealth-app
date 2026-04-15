"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Utensils, Plus } from "lucide-react";
import { ClientMeal } from "./types";
import { MealSkeleton } from "./Skeletons";
import { MealCard } from "./MealCard";

interface MealsListProps {
  meals: ClientMeal[];
  isLoading: boolean;
  onAddMeal: () => void;
  onEditMeal: (meal: ClientMeal) => void;
  onDeleteMeal: (mealId: string) => void;
}

export function MealsList({
  meals,
  isLoading,
  onAddMeal,
  onEditMeal,
  onDeleteMeal,
}: MealsListProps) {
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Today&apos;s Meals</h3>
        <span className="text-sm text-slate-400">{meals.length} meals logged</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <MealSkeleton key={i} />
          ))}
        </div>
      ) : meals.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-8 text-center">
          <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h4 className="text-white font-medium mb-2">No meals logged today</h4>
          <p className="text-slate-400 text-sm mb-4">Start tracking your nutrition by adding meals</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddMeal}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors"
          >
            Add Your First Meal
          </motion.button>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal, index) => (
            <MealCard
              key={meal.id}
              meal={meal}
              index={index}
              isExpanded={expandedMeal === meal.id}
              onToggleExpand={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
              onEdit={() => onEditMeal(meal)}
              onDelete={() => onDeleteMeal(meal.id)}
            />
          ))}
        </div>
      )}

      {/* Quick Add Meal Button */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onAddMeal}
        className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Log a Meal
      </motion.button>
    </div>
  );
}
