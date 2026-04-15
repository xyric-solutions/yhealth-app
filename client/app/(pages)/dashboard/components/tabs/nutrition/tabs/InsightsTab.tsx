"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Lightbulb,
  Target,
  Settings,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Dumbbell,
  RefreshCw,
} from "lucide-react";
import {
  nutritionService,
  PatternAnalysis,
  DailyAnalysis,
  AdjustedTargets,
  NutritionUserPreferences,
} from "@/src/shared/services/nutrition.service";
import { AdherencePatternsChart } from "../AdherencePatternsChart";

interface InsightsTabProps {
  onOpenPreferences?: () => void;
}

export function InsightsTab({ onOpenPreferences }: InsightsTabProps) {
  const [insights, setInsights] = useState<PatternAnalysis | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<DailyAnalysis[]>([]);
  const [adjustedTargets, setAdjustedTargets] = useState<AdjustedTargets | null>(null);
  const [, setPreferences] = useState<NutritionUserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [insightsRes, historyRes, targetsRes, prefsRes] = await Promise.all([
        nutritionService.getInsights(30).catch(() => null),
        nutritionService.getAnalysisHistory({ limit: 7 }).catch(() => null),
        nutritionService.getAdaptivePlan().catch(() => null),
        nutritionService.getNutritionPreferences().catch(() => null),
      ]);

      if (insightsRes?.success && insightsRes.data) setInsights(insightsRes.data);
      if (historyRes?.success && historyRes.data?.analyses) setRecentAnalyses(historyRes.data.analyses);
      if (targetsRes?.success && targetsRes.data) setAdjustedTargets(targetsRes.data);
      if (prefsRes?.success && prefsRes.data) setPreferences(prefsRes.data);
    } catch (_err) {
      setError("Failed to load insights");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDeviationColor = (percent: number) => {
    const abs = Math.abs(percent);
    if (abs <= 5) return "text-emerald-400";
    if (abs <= 15) return "text-amber-400";
    if (abs <= 30) return "text-orange-400";
    return "text-red-400";
  };

  const getDeviationBg = (percent: number) => {
    const abs = Math.abs(percent);
    if (abs <= 5) return "bg-emerald-500/20";
    if (abs <= 15) return "bg-amber-500/20";
    if (abs <= 30) return "bg-orange-500/20";
    return "bg-red-500/20";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h3 className="text-white font-medium mb-2">Unable to load insights</h3>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <button
          onClick={() => loadData()}
          className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Nutrition Insights</h2>
          <p className="text-sm text-slate-400">AI-powered analysis of your eating patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </motion.button>
          {onOpenPreferences && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenPreferences}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Today's Adjusted Target */}
      {adjustedTargets && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/30">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Today&apos;s Target</h3>
              <p className="text-sm text-slate-300">{adjustedTargets.adjustmentReason}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/50">
              <p className="text-sm text-slate-400 mb-1">Base Target</p>
              <p className="text-lg font-semibold text-white">
                {adjustedTargets.baseCalories.toLocaleString()}
                <span className="text-sm font-normal text-slate-400 ml-1">kcal</span>
              </p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-400 mb-1">Adjusted Target</p>
              <p className="text-lg font-semibold text-emerald-400">
                {adjustedTargets.adjustedCalories.toLocaleString()}
                <span className="text-sm font-normal text-emerald-300 ml-1">kcal</span>
              </p>
            </div>
          </div>
          {adjustedTargets.workoutCalorieAdjustment > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-300">
              <Dumbbell className="w-4 h-4" />
              <span>+{adjustedTargets.workoutCalorieAdjustment} kcal from workout</span>
            </div>
          )}
        </div>
      )}

      {/* Strengths & Challenges Grid */}
      {insights && (insights.strengths.length > 0 || insights.challenges.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Strengths */}
          {insights.strengths.length > 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Your Strengths</h3>
              </div>
              <div className="space-y-3">
                {insights.strengths.map((strength: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-300">{strength}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challenges */}
          {insights.challenges.length > 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Areas to Improve</h3>
              </div>
              <div className="space-y-3">
                {insights.challenges.map((challenge: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-300">{challenge}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Day-of-Week Patterns */}
      <AdherencePatternsChart />

      {/* Recommendations */}
      {insights?.recommendations && insights.recommendations.length > 0 && (
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Personalized Recommendations</h3>
          </div>
          <div className="space-y-3">
            {insights.recommendations.map((rec: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50"
              >
                <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent History */}
      {recentAnalyses.length > 0 && (
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Recent Days</h3>
          </div>
          <div className="space-y-2">
            {recentAnalyses.slice(0, 7).map((analysis) => {
              const date = new Date(analysis.date);
              const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
              const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <div
                  key={analysis.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <p className="text-xs text-slate-500">{dayName}</p>
                      <p className="text-sm text-white font-medium">{dateStr}</p>
                    </div>
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getDeviationBg(analysis.deviation.deviationPercent)} ${getDeviationColor(analysis.deviation.deviationPercent)}`}
                    >
                      {analysis.deviation.classification === "on_target"
                        ? "On target"
                        : analysis.deviation.classification === "missed_day"
                          ? "Missed"
                          : `${Math.abs(analysis.deviation.deviationPercent).toFixed(0)}% ${analysis.deviation.calorieDeviation < 0 ? "under" : "over"}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white font-medium">
                      {analysis.summary.totalCalories.toLocaleString()} kcal
                    </p>
                    <p className="text-xs text-slate-500">
                      / {analysis.targets.calories.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Data State */}
      {!insights && recentAnalyses.length === 0 && (
        <div className="text-center py-12 rounded-2xl bg-slate-800/50 border border-slate-700/50">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No insights yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Keep logging your meals and the adaptive system will learn your patterns and
            provide personalized insights.
          </p>
        </div>
      )}
    </motion.div>
  );
}
