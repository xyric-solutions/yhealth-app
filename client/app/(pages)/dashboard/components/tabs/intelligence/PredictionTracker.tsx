'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Target, TrendingUp } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { PredictionAccuracyStat } from '@shared/types/domain/intelligence';

export function PredictionTracker() {
  const [stats, setStats] = useState<PredictionAccuracyStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await intelligenceService.getPredictionAccuracy(30);
        if (!cancelled && res.data?.stats) setStats(res.data.stats);
      } catch {
        // Non-critical — show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const getAccuracyColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-400';
    if (pct >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Overall Accuracy */}
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Prediction Accuracy</h3>
          <span className="text-xs text-slate-400">(30-day)</span>
        </div>

        {loading ? (
          <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
        ) : !stats || stats.totalTracked === 0 ? (
          <div className="text-center py-8">
            <Brain className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No predictions tracked yet.</p>
            <p className="text-xs text-slate-500 mt-1">Accuracy tracking starts after your second daily report.</p>
          </div>
        ) : (
          <>
            {/* Big accuracy number */}
            <div className="flex items-end gap-4 mb-6">
              <span className={`text-5xl font-bold ${getAccuracyColor(stats.overallAccuracy)}`}>
                {stats.overallAccuracy}%
              </span>
              <span className="text-sm text-slate-400 pb-2">
                overall accuracy ({stats.totalTracked} predictions)
              </span>
            </div>

            {/* By type */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats.byType).map(([type, data]) => (
                <div key={type} className="rounded-xl bg-white/5 border border-white/5 p-3">
                  <span className="text-[10px] text-slate-400 capitalize block mb-1">{type}</span>
                  <span className={`text-xl font-bold ${getAccuracyColor(data.accuracy)}`}>
                    {data.accuracy}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">{data.count} tracked</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recent Predictions Table */}
      {stats && stats.recentPredictions.length > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Recent Predictions vs Actuals</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-right py-2 pr-4">Predicted</th>
                  <th className="text-right py-2 pr-4">Actual</th>
                  <th className="text-right py-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPredictions.slice(0, 10).map((p, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b border-white/5"
                  >
                    <td className="py-2 pr-4 text-slate-300">{p.date}</td>
                    <td className="py-2 pr-4 text-slate-300 capitalize">{p.type}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{p.predicted.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-right text-white font-medium">{p.actual.toFixed(1)}</td>
                    <td className={`py-2 text-right font-medium ${getAccuracyColor(p.accuracyPct)}`}>
                      {p.accuracyPct.toFixed(0)}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
