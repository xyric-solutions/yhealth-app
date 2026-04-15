"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Edit3, Trash2, Check } from "lucide-react";
import { ClientDietPlan } from "./types";
import { DIET_TYPES } from "./constants";

interface DietPlanCardProps {
  plan: ClientDietPlan;
  index: number;
  isSelected: boolean;
  onToggleSelection: () => void;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DietPlanCard({
  plan,
  index,
  isSelected,
  onToggleSelection,
  onActivate,
  onEdit,
  onDelete,
}: DietPlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-2xl border p-5 transition-all ${
        plan.isActive
          ? "bg-emerald-500/10 border-emerald-500/30"
          : isSelected
          ? "bg-red-500/5 border-red-500/30"
          : "bg-slate-800/50 border-slate-700/50"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggleSelection}
            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? "border-red-500 bg-red-500"
                : "border-slate-600 hover:border-slate-500"
            }`}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-white">{plan.name}</h4>
              {plan.isActive && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {DIET_TYPES.find((t) => t.id === plan.type)?.label || plan.type}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!plan.isActive && (
            <button
              onClick={onActivate}
              className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Set as active"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Calories</p>
          <p className="text-base font-semibold text-orange-400">{plan.targetCalories}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Protein</p>
          <p className="text-base font-semibold text-red-400">{plan.targetProtein}g</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Carbs</p>
          <p className="text-base font-semibold text-amber-400">{plan.targetCarbs}g</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-slate-500 mb-1">Fat</p>
          <p className="text-base font-semibold text-purple-400">{plan.targetFat}g</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs">
        <span className="text-slate-500">{plan.mealsPerDay} meals/day</span>
        <span className="text-slate-500">Created {plan.createdAt}</span>
      </div>
    </motion.div>
  );
}
