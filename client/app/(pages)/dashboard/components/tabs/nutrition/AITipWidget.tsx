"use client";

import { Info } from "lucide-react";
import { MacroTarget } from "./types";

interface AITipWidgetProps {
  macros: Record<string, MacroTarget>;
}

export function AITipWidget({ macros }: AITipWidgetProps) {
  const proteinMacro = macros.protein;
  const isProteinLow = proteinMacro && proteinMacro.current < proteinMacro.target * 0.7;

  return (
    <div className="rounded-2xl bg-sky-500/[0.06] border border-sky-500/40 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
          <Info className="w-3.5 h-3.5 text-sky-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-white font-semibold text-sm mb-0.5">AI Tip</h4>
          <p className="text-xs text-slate-300 leading-relaxed break-words">
            {isProteinLow
              ? `You're ${Math.round(proteinMacro.target - proteinMacro.current)}g short on protein. Consider adding a protein shake.`
              : "Great job hitting your protein goals! Keep up the consistent nutrition."}
          </p>
        </div>
      </div>
    </div>
  );
}
