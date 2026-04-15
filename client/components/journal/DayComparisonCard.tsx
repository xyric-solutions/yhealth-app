/**
 * @file DayComparisonCard Component
 * @description Side-by-side predicted vs actual mood/energy comparison with delta arrows
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, Sun, Moon } from "lucide-react";
import { dailyCheckinService } from "@/src/shared/services/wellbeing.service";
import type { DayComparison } from "@shared/types/domain/wellbeing";

interface DayComparisonCardProps {
  date?: string;
}

export function DayComparisonCard({ date }: DayComparisonCardProps) {
  const [comparison, setComparison] = useState<DayComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dailyCheckinService.getComparison(date).then((res) => {
      if (res.success && res.data?.comparison) {
        setComparison(res.data.comparison);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [date]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 w-12 bg-white/10 rounded" />
            <div className="h-8 w-24 bg-white/10 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-12 bg-white/10 rounded" />
            <div className="h-8 w-24 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) return null;
  if (!comparison.morning && !comparison.evening) return null;

  const moodDelta = comparison.moodDelta;
  const energyDelta = comparison.energyDelta;

  return (
    <motion.div
      className="p-4 rounded-xl bg-white/5 border border-white/10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h4 className="text-sm font-medium text-slate-300 mb-4">Predicted vs Actual</h4>

      <div className="grid grid-cols-2 gap-4">
        {/* Mood */}
        <div className="space-y-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Mood</span>
          <div className="flex items-center gap-2">
            <div className="text-center">
              <Sun className="w-3 h-3 text-amber-400 mx-auto mb-1" />
              <span className="text-lg font-bold text-white">
                {comparison.morning?.predictedMood ?? "—"}
              </span>
            </div>
            <DeltaArrow delta={moodDelta} />
            <div className="text-center">
              <Moon className="w-3 h-3 text-indigo-400 mx-auto mb-1" />
              <span className="text-lg font-bold text-white">
                {comparison.evening?.moodScore ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Energy */}
        <div className="space-y-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Energy</span>
          <div className="flex items-center gap-2">
            <div className="text-center">
              <Sun className="w-3 h-3 text-amber-400 mx-auto mb-1" />
              <span className="text-lg font-bold text-white">
                {comparison.morning?.predictedEnergy ?? "—"}
              </span>
            </div>
            <DeltaArrow delta={energyDelta} />
            <div className="text-center">
              <Moon className="w-3 h-3 text-indigo-400 mx-auto mb-1" />
              <span className="text-lg font-bold text-white">
                {comparison.evening?.energyScore ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Intention fulfillment */}
      {comparison.intentionsTotal > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Intentions fulfilled</span>
            <span className="text-sm font-medium text-emerald-400">
              {comparison.intentionsFulfilled}/{comparison.intentionsTotal}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DeltaArrow({ delta }: { delta?: number }) {
  if (delta === undefined || delta === null) {
    return <Minus className="w-4 h-4 text-slate-600" />;
  }

  if (delta > 0) {
    return (
      <div className="flex flex-col items-center">
        <ArrowUp className="w-4 h-4 text-emerald-400" />
        <span className="text-[10px] text-emerald-400">+{delta}</span>
      </div>
    );
  }
  if (delta < 0) {
    return (
      <div className="flex flex-col items-center">
        <ArrowDown className="w-4 h-4 text-red-400" />
        <span className="text-[10px] text-red-400">{delta}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <Minus className="w-4 h-4 text-slate-500" />
      <span className="text-[10px] text-slate-500">0</span>
    </div>
  );
}
