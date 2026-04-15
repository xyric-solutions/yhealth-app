"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  ChevronRight,
  Zap,
  Heart,
  Dumbbell,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { nutritionService, DailyAnalysis, AdjustmentRecord } from "@/src/shared/services/nutrition.service";

interface DailyNutritionInsightsProps {
  onViewDetails?: () => void;
}

export function DailyNutritionInsights({ onViewDetails }: DailyNutritionInsightsProps) {
  const [analysis, setAnalysis] = useState<DailyAnalysis | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<AdjustmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];

      // Fetch analysis and pending adjustments in parallel
      const [analysisRes, adjustmentsRes] = await Promise.all([
        nutritionService.getDailyAnalysis(dateStr).catch(() => null),
        nutritionService.getPendingAdjustments().catch(() => null),
      ]);

      if (analysisRes?.success && analysisRes.data?.analysis) {
        setAnalysis(analysisRes.data.analysis);
      }

      if (adjustmentsRes?.success && adjustmentsRes.data?.adjustments && adjustmentsRes.data.adjustments.length > 0) {
        setPendingAdjustment(adjustmentsRes.data.adjustments[0]);
      }
    } catch (_err) {
      setError("Failed to load nutrition insights");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentResponse = async (choice: "accept" | "skip") => {
    if (!pendingAdjustment) return;

    try {
      setResponding(true);
      await nutritionService.submitAdjustmentResponse({
        adjustmentId: pendingAdjustment.id,
        choice,
      });
      setPendingAdjustment(null);
      // Reload to get updated state
      loadData();
    } catch (_err) {
      setError("Failed to submit response");
    } finally {
      setResponding(false);
    }
  };

  const getDeviationColor = (classification: string) => {
    if (classification === "on_target") return "text-emerald-400";
    if (classification.includes("minor")) return "text-amber-400";
    if (classification.includes("significant")) return "text-orange-400";
    if (classification.includes("severe") || classification === "missed_day") return "text-red-400";
    return "text-slate-400";
  };

  const getDeviationBg = (classification: string) => {
    if (classification === "on_target") return "bg-emerald-500/20";
    if (classification.includes("minor")) return "bg-amber-500/20";
    if (classification.includes("significant")) return "bg-orange-500/20";
    if (classification.includes("severe") || classification === "missed_day") return "bg-red-500/20";
    return "bg-slate-500/20";
  };

  const getDeviationIcon = (classification: string) => {
    if (classification === "on_target") return Target;
    if (classification.includes("under")) return TrendingDown;
    if (classification.includes("over")) return TrendingUp;
    if (classification === "missed_day") return Calendar;
    return AlertCircle;
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-700 animate-pulse" />
          <div className="h-5 w-32 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-700/50 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-700/50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return null; // Don't show anything if no analysis available
  }

  const DeviationIcon = getDeviationIcon(analysis.deviation.classification);
  const absPercent = Math.abs(analysis.deviation.deviationPercent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-700/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${getDeviationBg(analysis.deviation.classification)}`}>
              <DeviationIcon className={`w-5 h-5 ${getDeviationColor(analysis.deviation.classification)}`} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Yesterday&apos;s Nutrition</h3>
              <p className="text-sm text-slate-400">
                {analysis.summary.totalCalories.toLocaleString()} / {analysis.targets.calories.toLocaleString()} kcal
              </p>
            </div>
          </div>
          {analysis.deviation.classification !== "on_target" && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${getDeviationBg(analysis.deviation.classification)} ${getDeviationColor(analysis.deviation.classification)}`}
            >
              {absPercent.toFixed(0)}% {analysis.deviation.calorieDeviation < 0 ? "under" : "over"}
            </span>
          )}
          {analysis.deviation.classification === "on_target" && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
              On target
            </span>
          )}
        </div>
      </div>

      {/* WHOOP Context (if available) */}
      {(analysis.whoopContext.hasWorkout || analysis.whoopContext.recoveryScore !== null) && (
        <div className="px-4 sm:px-5 py-3 border-b border-slate-700/50 flex flex-wrap gap-4">
          {analysis.whoopContext.hasWorkout && (
            <div className="flex items-center gap-2 text-sm">
              <Dumbbell className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">
                {analysis.whoopContext.workoutCalories} cal burned
              </span>
            </div>
          )}
          {analysis.whoopContext.recoveryScore !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Heart className="w-4 h-4 text-red-400" />
              <span className="text-slate-300">
                {analysis.whoopContext.recoveryScore}% recovery
              </span>
            </div>
          )}
          {analysis.whoopContext.strainScore !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">
                {analysis.whoopContext.strainScore.toFixed(1)} strain
              </span>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {analysis.aiAnalysis && (
        <div className="px-4 sm:px-5 py-4">
          <p className="text-sm text-slate-300 leading-relaxed">{analysis.aiAnalysis}</p>
        </div>
      )}

      {/* Pending Adjustment Card */}
      <AnimatePresence>
        {pendingAdjustment && pendingAdjustment.type !== "skip" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-700/50"
          >
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white mb-1">Suggested Adjustment</h4>
                  <p className="text-sm text-slate-400">
                    Add {pendingAdjustment.dailyAdjustment} cal/day for{" "}
                    {pendingAdjustment.redistributionDays} day
                    {pendingAdjustment.redistributionDays > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {pendingAdjustment.coachingMessage && (
                <p className="text-xs text-slate-400 mb-4 italic">
                  &ldquo;{pendingAdjustment.coachingMessage.slice(0, 150)}
                  {pendingAdjustment.coachingMessage.length > 150 ? "..." : ""}&rdquo;
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAdjustmentResponse("accept")}
                  disabled={responding}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {responding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Accept
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAdjustmentResponse("skip")}
                  disabled={responding}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Skip
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Details Link */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-t border-slate-700/50"
        >
          <span>View full analysis</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
