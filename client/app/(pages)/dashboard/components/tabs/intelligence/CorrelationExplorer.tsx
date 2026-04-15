'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Link2 } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';

interface CorrelationItem {
  id?: string;
  pattern_type?: string;
  headline?: string;
  insight?: string;
  correlation_strength?: number;
  confidence?: string;
  data_points?: number;
}

export function CorrelationExplorer() {
  const [correlations, setCorrelations] = useState<CorrelationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await intelligenceService.getCorrelations();
        if (!cancelled && res.data?.correlations) {
          setCorrelations(res.data.correlations as CorrelationItem[]);
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

  const getStrengthColor = (strength: number | undefined) => {
    if (!strength) return 'bg-slate-500';
    const abs = Math.abs(strength);
    if (abs >= 0.7) return 'bg-emerald-500';
    if (abs >= 0.4) return 'bg-amber-500';
    return 'bg-slate-500';
  };

  const getStrengthLabel = (strength: number | undefined) => {
    if (!strength) return 'Unknown';
    const abs = Math.abs(strength);
    if (abs >= 0.7) return 'Strong';
    if (abs >= 0.4) return 'Moderate';
    return 'Weak';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Health Correlations</h3>
        <span className="text-xs text-slate-400">{correlations.length} detected</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : correlations.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No correlations detected yet.</p>
          <p className="text-xs text-slate-500 mt-1">Keep tracking for at least 7 days to discover patterns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {correlations.map((corr, idx) => (
            <motion.div
              key={corr.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl bg-white/5 border border-white/10 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white mb-1">{corr.headline || corr.pattern_type}</p>
                  <p className="text-xs text-slate-400">{corr.insight}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {/* Strength indicator */}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${getStrengthColor(corr.correlation_strength)}`} />
                    <span className="text-[10px] text-slate-400">{getStrengthLabel(corr.correlation_strength)}</span>
                  </div>
                  {corr.confidence && (
                    <span className="text-[10px] text-slate-500 capitalize">{corr.confidence} conf.</span>
                  )}
                  {corr.data_points && (
                    <span className="text-[10px] text-slate-500">{corr.data_points} pts</span>
                  )}
                </div>
              </div>

              {/* Strength bar */}
              {corr.correlation_strength != null && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${getStrengthColor(corr.correlation_strength)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.abs(corr.correlation_strength) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
