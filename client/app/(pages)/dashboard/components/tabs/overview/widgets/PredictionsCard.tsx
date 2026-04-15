'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Moon, Sun, Brain, RefreshCw } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { Prediction } from '@shared/types/domain/intelligence';

const PREDICTION_ICONS: Record<string, typeof Zap> = {
  energy: Zap,
  mood: Sun,
  sleep: Moon,
  stress: Brain,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export function PredictionsCard() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await intelligenceService.getLatestReport();
      if (res.data?.report?.predictions) {
        setPredictions(res.data.report.predictions);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Today&apos;s Predictions</h3>
      </div>

      {error ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Unable to load predictions</span>
          <button onClick={fetchData} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : predictions.length === 0 ? (
        <p className="text-xs text-slate-400">No predictions available yet. Check back after your first daily report.</p>
      ) : (
        <div className="space-y-2.5">
          {predictions.slice(0, 4).map((pred, idx) => {
            const type = (pred.type || '').toLowerCase();
            const Icon = PREDICTION_ICONS[type] || Sparkles;
            const confClass = CONFIDENCE_COLORS[pred.confidence] || CONFIDENCE_COLORS.low;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white capitalize">{type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${confClass}`}>
                      {pred.confidence}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-white">{pred.predicted_value}</span>
                  <span className="text-[10px] text-slate-400 ml-1">{type === 'sleep' ? 'hrs' : '/ 10'}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
