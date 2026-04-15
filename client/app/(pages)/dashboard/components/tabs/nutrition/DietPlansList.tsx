"use client";

import { motion } from "framer-motion";
import { Clock, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { ClientDietPlan } from "./types";
import { DietPlanSkeleton } from "./Skeletons";
import { DietPlanCard } from "./DietPlanCard";

interface DietPlansListProps {
  plans: ClientDietPlan[];
  isLoading: boolean;
  selectedIds: Set<string>;
  isAIGenerating: boolean;
  onCreatePlan: () => void;
  onGenerateAIPlan: () => void;
  onToggleSelection: (planId: string) => void;
  onDeleteSelected: () => void;
  onActivatePlan: (planId: string) => void;
  onEditPlan: (plan: ClientDietPlan) => void;
  onDeletePlan: (planId: string) => void;
}

export function DietPlansList({
  plans,
  isLoading,
  selectedIds,
  isAIGenerating,
  onCreatePlan,
  onGenerateAIPlan,
  onToggleSelection,
  onDeleteSelected,
  onActivatePlan,
  onEditPlan,
  onDeletePlan,
}: DietPlansListProps) {
  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold text-white">Your Diet Plans</h3>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDeleteSelected}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreatePlan}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <DietPlanSkeleton key={i} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-8 text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h4 className="text-white font-medium mb-2">No diet plans yet</h4>
          <p className="text-slate-400 text-sm mb-4">Generate an AI-powered plan or create a custom one</p>
          <div className="flex items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onGenerateAIPlan}
              disabled={isAIGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAIGenerating ? (
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
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCreatePlan}
              className="px-4 py-2 rounded-xl bg-slate-700 text-white font-medium text-sm hover:bg-slate-600 transition-colors"
            >
              Create Manual Plan
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((plan, index) => (
            <DietPlanCard
              key={plan.id}
              plan={plan}
              index={index}
              isSelected={selectedIds.has(plan.id)}
              onToggleSelection={() => onToggleSelection(plan.id)}
              onActivate={() => onActivatePlan(plan.id)}
              onEdit={() => onEditPlan(plan)}
              onDelete={() => onDeletePlan(plan.id)}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
