"use client";

import { motion } from "framer-motion";
import { Utensils, Plus } from "lucide-react";
import { MacroTarget, ClientDietPlan } from "./types";
import { MacroCircularChart } from "./MacroCircularChart";

interface MacroOverviewProps {
  macros: Record<string, MacroTarget>;
  activePlan: ClientDietPlan | undefined;
  onAddMeal: () => void;
}

export function MacroOverview({ macros, activePlan, onAddMeal }: MacroOverviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-transparent border border-emerald-500/20 p-4 sm:p-6"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 shrink-0">
                <Utensils className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-emerald-400 text-sm font-medium">AI Nutrition Plan</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mb-1">Today&apos;s Nutrition</h2>
            <p className="text-slate-400 text-sm truncate">
              {activePlan ? activePlan.name : "No active plan - create one to track macros"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddMeal}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Add</span> Meal
            </motion.button>
          </div>
        </div>

        {/* Macro Progress Rings - Circular Charts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {Object.entries(macros).map(([key, value]) => {
            
            // Map Tailwind color classes to hex values matching MACRO_COLORS
            const colorMap: Record<string, { primary: string; secondary: string }> = {
              'calories': { primary: '#f97316', secondary: '#ef4444' }, // orange-500 to red-500
              'protein': { primary: '#ef4444', secondary: '#ec4899' }, // red-500 to pink-500
              'carbs': { primary: '#f59e0b', secondary: '#eab308' }, // amber-500 to yellow-500
              'fat': { primary: '#a855f7', secondary: '#8b5cf6' }, // purple-500 to violet-500
            };

            const hexColors = colorMap[key] || { primary: '#a855f7', secondary: '#8b5cf6' };

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center"
              >
                <MacroCircularChart
                  value={value.current}
                  max={value.target}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  unit={value.unit}
                  primaryColor={hexColors.primary}
                  secondaryColor={hexColors.secondary}
                  size="md"
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
