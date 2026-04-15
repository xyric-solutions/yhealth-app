'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Calendar } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { DailyScore, ScoreTrendPoint, ComponentScores } from '@shared/types/domain/intelligence';

const COMPONENTS: Array<{ key: keyof ComponentScores; label: string; color: string; weight: string }> = [
  { key: 'workout', label: 'Workout', color: 'bg-orange-500', weight: '30%' },
  { key: 'nutrition', label: 'Nutrition', color: 'bg-green-500', weight: '20%' },
  { key: 'wellbeing', label: 'Wellbeing', color: 'bg-pink-500', weight: '15%' },
  { key: 'biometrics', label: 'Biometrics', color: 'bg-cyan-500', weight: '15%' },
  { key: 'engagement', label: 'Engagement', color: 'bg-violet-500', weight: '10%' },
  { key: 'consistency', label: 'Consistency', color: 'bg-amber-500', weight: '10%' },
];

export function HealthScoreBreakdown() {
  const [score, setScore] = useState<DailyScore | null>(null);
  const [trend, setTrend] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [scoreRes, trendRes] = await Promise.all([
          intelligenceService.getScoreBreakdown(),
          intelligenceService.getScoreTrend(30),
        ]);
        if (!cancelled) {
          if (scoreRes.data?.score) setScore(scoreRes.data.score);
          if (trendRes.data?.trend) setTrend(trendRes.data.trend);
        }
      } catch {
        // Non-critical — show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const maxTrendScore = trend.length > 0 ? Math.max(...trend.map((t) => t.totalScore), 100) : 100;

  return (
    <div className="space-y-6">
      {/* Today's Full Breakdown */}
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Score Breakdown</h3>
          {score && <span className="text-xs text-slate-400">{score.date}</span>}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !score ? (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No score data available for today.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total score */}
            <div className="text-center mb-4">
              <span className={`text-5xl font-bold ${
                score.totalScore >= 80 ? 'text-emerald-400' :
                score.totalScore >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {score.totalScore}
              </span>
              <span className="text-lg text-slate-400">/100</span>
            </div>

            {/* Component bars with weights */}
            {COMPONENTS.map((comp) => {
              const val = score.componentScores[comp.key] ?? 0;
              return (
                <div key={comp.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${comp.color}`} />
                      <span className="text-xs text-white font-medium">{comp.label}</span>
                      <span className="text-[10px] text-slate-500">({comp.weight})</span>
                    </div>
                    <span className="text-xs text-slate-300 font-medium">{val}</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${comp.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Explanation */}
            {score.explanation && (
              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/5">
                <p className="text-xs text-slate-400">{score.explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 30-Day Trend */}
      {trend.length > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">30-Day Score Trend</h3>
          </div>

          {/* Simple bar chart */}
          <div className="flex items-end gap-0.5 h-24 sm:h-32 md:h-40">
            {trend.map((point, idx) => {
              const height = (point.totalScore / maxTrendScore) * 100;
              const color = point.totalScore >= 80 ? 'bg-emerald-500' :
                           point.totalScore >= 60 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <motion.div
                  key={idx}
                  className={`flex-1 rounded-t ${color} min-w-[3px]`}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.4, delay: idx * 0.02 }}
                  title={`${point.date}: ${point.totalScore}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-slate-500">{trend[0]?.date}</span>
            <span className="text-[10px] text-slate-500">{trend[trend.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}
