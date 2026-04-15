'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Flame, Check, X, Trophy, RefreshCw } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { FormulaProgress } from '@shared/types/domain/intelligence';

export function BestDayProgress() {
  const [progress, setProgress] = useState<FormulaProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await intelligenceService.getBestDayProgress();
      if (res.data?.progress) setProgress(res.data.progress);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const score = progress?.achievementScore ?? 0;
  const streak = progress?.streak ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Best Day Formula</h3>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30">
            <Flame className="w-3 h-3 text-orange-400" />
            <span className="text-[11px] font-medium text-orange-400">{streak}d streak</span>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-2">Unable to load formula</p>
            <button onClick={fetchData} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse" />
        </div>
      ) : !progress || !progress.formula?.criteria?.length ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-400 text-center">
            Need more data to detect your best day pattern. Keep logging!
          </p>
        </div>
      ) : (
        <>
          {/* Score + Progress Bar */}
          <div className="mb-4">
            <div className="flex items-end justify-between mb-1.5">
              <span className={`text-lg font-bold ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-slate-300'}`}>
                {score}%
              </span>
              <span className="text-[11px] text-slate-400">of formula achieved</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-slate-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
          </div>

          {/* Criteria Checklist */}
          <div className="space-y-2">
            {progress.formula.criteria.map((criterion, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.1 }}
                className="flex items-center gap-2"
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${criterion.met ? 'bg-emerald-500/30' : 'bg-white/10'}`}>
                  {criterion.met ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <X className="w-3 h-3 text-slate-500" />
                  )}
                </div>
                <span className={`text-xs ${criterion.met ? 'text-white' : 'text-slate-400'}`}>
                  {criterion.label}: {criterion.threshold}
                </span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
