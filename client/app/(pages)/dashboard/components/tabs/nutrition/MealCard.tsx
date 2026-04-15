"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Flame, Beef, Wheat, Apple, Edit3, Trash2, ChevronDown } from "lucide-react";
import { ClientMeal } from "./types";
import { MEAL_ICONS, getFoodIcon } from "./constants";
import { formatTime } from "./utils";

interface MealCardProps {
  meal: ClientMeal;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MealCard({
  meal,
  index,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: MealCardProps) {
  const MealIcon = MEAL_ICONS[meal.icon];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-2xl bg-slate-800/50 border border-slate-700/50"
    >
      <div
        className="p-5 cursor-pointer hover:bg-white/5 transition-colors rounded-t-2xl"
        onClick={onToggleExpand}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/20">
            <MealIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-white">{meal.name}</h4>
              <span className="text-xs text-slate-500">{formatTime(meal.time)}</span>
            </div>
            <p className="text-sm text-slate-400 mb-3 truncate">
              {meal.items.map((i) => i.name).join(" • ")}
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Flame className="w-3 h-3 text-orange-400" />
                {meal.calories} kcal
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Beef className="w-3 h-3 text-red-400" />
                {meal.protein}g protein
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Wheat className="w-3 h-3 text-amber-400" />
                {meal.carbs}g carbs
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Apple className="w-3 h-3 text-purple-400" />
                {meal.fat}g fat
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
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
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-slate-700/50">
              <h5 className="text-sm font-medium text-slate-300 mb-3">Food Items</h5>
              <div className="space-y-2">
                {meal.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50"
                  >
                    <span className="text-xl flex-shrink-0">{getFoodIcon(item.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.portion}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-orange-400">{item.calories} kcal</p>
                      <p className="text-xs text-slate-500">
                        P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
