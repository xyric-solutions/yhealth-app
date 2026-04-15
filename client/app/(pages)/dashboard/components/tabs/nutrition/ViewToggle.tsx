"use client";

import { Utensils, Clock, Salad, LucideIcon } from "lucide-react";

type ViewType = "today" | "plan" | "recipes";

interface ViewToggleProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

interface ViewOption {
  id: ViewType;
  label: string;
  icon: LucideIcon;
}

const VIEW_OPTIONS: ViewOption[] = [
  { id: "today", label: "Today", icon: Utensils },
  { id: "plan", label: "Plans", icon: Clock },
  { id: "recipes", label: "Recipes", icon: Salad },
];

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50 w-fit">
      {VIEW_OPTIONS.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            activeView === view.id
              ? "bg-emerald-500 text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <view.icon className="w-4 h-4" />
          {view.label}
        </button>
      ))}
    </div>
  );
}

export type { ViewType };
