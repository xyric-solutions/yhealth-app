'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { DailyScore, ComponentScores } from '@shared/types/domain/intelligence';

const COMPONENT_LABELS: Record<keyof ComponentScores, { label: string; color: string }> = {
  workout: { label: 'Workout', color: 'bg-orange-500' },
  nutrition: { label: 'Nutrition', color: 'bg-green-500' },
  wellbeing: { label: 'Wellbeing', color: 'bg-pink-500' },
  biometrics: { label: 'Biometrics', color: 'bg-cyan-500' },
  engagement: { label: 'Engagement', color: 'bg-violet-500' },
  consistency: { label: 'Consistency', color: 'bg-amber-500' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreGlow(score: number): string {
  if (score >= 80) return 'shadow-emerald-500/30';
  if (score >= 60) return 'shadow-amber-500/30';
  return 'shadow-red-500/30';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#fbbf24';
  return '#f87171';
}

export function HealthScoreHero() {
  const [score, setScore] = useState<DailyScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prevScore, setPrevScore] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [todayRes, trendRes] = await Promise.all([
        intelligenceService.getScoreBreakdown(),
        intelligenceService.getScoreTrend(2),
      ]);
      if (todayRes.data?.score) setScore(todayRes.data.score);
      if (trendRes.data?.trend && trendRes.data.trend.length >= 2) {
        setPrevScore(trendRes.data.trend[trendRes.data.trend.length - 2].totalScore);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalScore = score?.totalScore ?? 0;
  const delta = prevScore !== null ? Math.round(totalScore - prevScore) : null;
  const circumference = 2 * Math.PI * 54;
  const progress = (totalScore / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6 shadow-lg ${getScoreGlow(totalScore)}`}
    >
      {error ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-400">Unable to load health score</span>
          </div>
          <button onClick={fetchData} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      ) : null}
      {!error && <div className="flex items-start gap-6">
        {/* Circular Score */}
        <div className="relative flex-shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <motion.circle
              cx="64" cy="64" r="54" fill="none"
              stroke={getScoreRingColor(totalScore)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: loading ? circumference : circumference - progress }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              transform="rotate(-90 64 64)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold ${getScoreColor(totalScore)}`}>
              {loading ? '--' : totalScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>

        {/* Score Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Health Score</h3>
            {delta !== null && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {delta > 0 ? '+' : ''}{delta}
              </span>
            )}
          </div>

          {/* Component Bars */}
          <div className="space-y-1.5 mt-3">
            {score?.componentScores && Object.entries(COMPONENT_LABELS).map(([key, { label, color }]) => {
              const val = score.componentScores[key as keyof ComponentScores] ?? 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 w-16 truncate">{label}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 w-6 text-right">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>}
    </motion.div>
  );
}
