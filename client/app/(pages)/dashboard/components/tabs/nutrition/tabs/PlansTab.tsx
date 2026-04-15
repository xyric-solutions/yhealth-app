"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Check,
  Clock,
  Sparkles,
  Loader2,
  Flame,
  Beef,
  Wheat,
  Apple,
  Utensils,
} from "lucide-react";
import type { ClientDietPlan } from "../types";
import { DietPlanSkeleton } from "../Skeletons";

const dietTypes = [
  { id: "balanced", label: "Balanced", description: "Equal macros distribution" },
  { id: "high_protein", label: "High Protein", description: "For muscle building" },
  { id: "low_carb", label: "Low Carb", description: "Reduce carbohydrates" },
  { id: "keto", label: "Keto", description: "Very low carb, high fat" },
  { id: "vegan", label: "Vegan", description: "Plant-based only" },
  { id: "mediterranean", label: "Mediterranean", description: "Heart-healthy diet" },
];

interface PlansTabProps {
  plans: ClientDietPlan[];
  plansLoading: boolean;
  selectedPlanIds: Set<string>;
  onPlanSelect: (planId: string) => void;
  onPlanDelete: (planId: string) => void;
  onPlansDelete: () => void;
  onPlanActivate: (planId: string) => void;
  onPlanEdit: (plan: ClientDietPlan) => void;
  onPlanCreate: () => void;
  onAIGenerate: () => void;
  aiGenerating: boolean;
}

export function PlansTab({
  plans,
  plansLoading,
  selectedPlanIds,
  onPlanSelect,
  onPlanDelete,
  onPlansDelete,
  onPlanActivate,
  onPlanEdit,
  onPlanCreate,
  onAIGenerate,
  aiGenerating,
}: PlansTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h3 className="text-[16px] sm:text-[18px] font-bold text-white tracking-tight">Your Diet Plans</h3>
          <p className="text-[11px] sm:text-[12px] text-slate-400 mt-0.5">Nutrition blueprints aligned to your goals</p>
        </div>
        <div className="flex gap-2">
          {selectedPlanIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onPlansDelete}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 font-semibold text-[13px] hover:bg-red-500/25 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedPlanIds.size})
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onAIGenerate}
            disabled={aiGenerating}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/30 text-violet-200 font-semibold text-[13px] hover:from-violet-500/30 hover:to-fuchsia-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI Generate
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onPlanCreate}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[13px] shadow-lg shadow-emerald-600/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Plan
          </motion.button>
        </div>
      </div>

      {plansLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <DietPlanSkeleton key={i} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Utensils className="w-6 h-6 text-emerald-300" />
          </div>
          <h4 className="text-white font-semibold mb-1 text-base">No diet plans yet</h4>
          <p className="text-slate-400 text-[13px] mb-5">Generate an AI-powered plan or create a custom one</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onAIGenerate}
              disabled={aiGenerating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold text-[13px] shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Plan
                </>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onPlanCreate}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-semibold text-[13px] hover:bg-white/[0.08] transition-all"
            >
              Create Manual Plan
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          {plans.map((plan, index) => {
            const isSelected = selectedPlanIds.has(plan.id);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all ${
                  plan.isActive
                    ? "border-emerald-500/50 bg-[linear-gradient(145deg,rgba(16,185,129,0.08)_0%,#0f1219_60%,#0a0d14_100%)] shadow-lg shadow-emerald-500/10"
                    : isSelected
                    ? "border-red-500/50 bg-[linear-gradient(145deg,rgba(239,68,68,0.08)_0%,#0f1219_60%,#0a0d14_100%)]"
                    : "border-white/[0.06] bg-[linear-gradient(145deg,#0f1219_0%,#0a0d14_100%)] hover:border-white/[0.12]"
                }`}
              >
                {plan.isActive && (
                  <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl" />
                )}
                <div className="relative flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => onPlanSelect(plan.id)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? "border-red-500 bg-red-500"
                          : "border-white/[0.15] bg-white/[0.03] hover:border-white/[0.3]"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-[15px] tracking-tight">{plan.name}</h4>
                        {plan.isActive && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {dietTypes.find((t) => t.id === plan.type)?.label || plan.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!plan.isActive && (
                      <button
                        onClick={() => onPlanActivate(plan.id)}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-300 transition-colors"
                        title="Set as active"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onPlanEdit(plan)}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onPlanDelete(plan.id)}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="relative grid grid-cols-4 gap-2">
                  {[
                    { icon: Flame, label: "Cal", value: plan.targetCalories, color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/20" },
                    { icon: Beef, label: "Protein", value: `${plan.targetProtein}g`, color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/20" },
                    { icon: Wheat, label: "Carbs", value: `${plan.targetCarbs}g`, color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                    { icon: Apple, label: "Fat", value: `${plan.targetFat}g`, color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div key={i} className={`rounded-xl p-2.5 border ${stat.bg} ${stat.border}`}>
                        <Icon className={`w-3.5 h-3.5 mb-1 ${stat.color}`} />
                        <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="relative mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Utensils className="w-3 h-3" />
                    {plan.mealsPerDay} meals/day
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    {plan.createdAt}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

