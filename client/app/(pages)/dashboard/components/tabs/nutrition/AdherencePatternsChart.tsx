"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { TrendingUp, Calendar, Lightbulb, ChevronRight, Loader2 } from "lucide-react";
import { nutritionService, PatternAnalysis, DayPattern } from "@/src/shared/services/nutrition.service";

interface AdherencePatternsChartProps {
  onViewInsights?: () => void;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function AdherencePatternsChart({ onViewInsights }: AdherencePatternsChartProps) {
  const [patterns, setPatterns] = useState<DayPattern[]>([]);
  const [insights, setInsights] = useState<PatternAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [patternsRes, insightsRes] = await Promise.all([
        nutritionService.getDayPatterns().catch(() => null),
        nutritionService.getInsights(30).catch(() => null),
      ]);

      if (patternsRes?.success && patternsRes.data?.patterns) {
        // Sort by day index
        const sorted = [...patternsRes.data.patterns].sort((a, b) => a.dayIndex - b.dayIndex);
        setPatterns(sorted);
      }

      if (insightsRes?.success && insightsRes.data) {
        setInsights(insightsRes.data);
      }
    } catch (_err) {
      setError("Failed to load patterns");
    } finally {
      setLoading(false);
    }
  };

  const getSuccessColor = (rate: number) => {
    if (rate >= 70) return "bg-emerald-500";
    if (rate >= 50) return "bg-amber-500";
    if (rate >= 30) return "bg-orange-500";
    return "bg-red-500";
  };

  const getSuccessOpacity = (rate: number) => {
    if (rate >= 70) return "opacity-100";
    if (rate >= 50) return "opacity-80";
    if (rate >= 30) return "opacity-60";
    return "opacity-40";
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || patterns.length === 0) {
    return null; // Don't show if no data
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Weekly Patterns</h3>
            <p className="text-sm text-slate-400">Your nutrition consistency by day</p>
          </div>
        </div>
      </div>

      {/* Day Pattern Bars */}
      <div className="p-4 sm:p-5">
        <div className="flex items-end justify-between gap-2 h-32 mb-4">
          {DAY_LABELS.map((label, index) => {
            const pattern = patterns.find((p) => p.dayIndex === index);
            const successRate = pattern?.successRate ?? 0;
            const height = Math.max(10, successRate);

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center justify-end h-24">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className={`w-full max-w-[24px] rounded-t-md ${getSuccessColor(successRate)} ${getSuccessOpacity(successRate)}`}
                  />
                </div>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>70%+</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>50-70%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-orange-500 opacity-60" />
            <span>&lt;50%</span>
          </div>
        </div>
      </div>

      {/* Insights Summary */}
      {insights && (insights.strengths.length > 0 || insights.challenges.length > 0) && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
          {insights.strengths.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-300">{insights.strengths[0]}</p>
              </div>
            </div>
          )}

          {insights.challenges.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300">{insights.challenges[0]}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View More Link */}
      {onViewInsights && (
        <button
          onClick={onViewInsights}
          className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-t border-slate-700/50"
        >
          <span>View all insights</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
