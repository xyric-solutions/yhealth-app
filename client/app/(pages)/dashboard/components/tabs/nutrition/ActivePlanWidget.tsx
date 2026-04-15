"use client";

import { Leaf } from "lucide-react";

interface ActivePlanWidgetProps {
  plan: {
    name: string;
    targetCalories: number;
    targetProtein: number;
    mealsPerDay: number;
  };
}

export function ActivePlanWidget({ plan }: ActivePlanWidgetProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-green-500/20 shrink-0">
          <Leaf className="w-4 h-4 text-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-white font-medium text-sm mb-1 truncate">{plan.name}</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {plan.targetCalories} kcal • {plan.targetProtein}g protein • {plan.mealsPerDay} meals/day
          </p>
        </div>
      </div>
    </div>
  );
}
