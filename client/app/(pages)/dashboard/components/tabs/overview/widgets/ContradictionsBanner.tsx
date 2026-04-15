'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { ContradictionSummary, StoredContradiction } from '@shared/types/domain/intelligence';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  low: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
};

export function ContradictionsBanner() {
  const [summary, setSummary] = useState<ContradictionSummary | null>(null);
  const [contradictions, setContradictions] = useState<StoredContradiction[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await intelligenceService.getContradictionSummary();
        if (res.data?.summary) setSummary(res.data.summary);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const total = summary ? summary.critical + summary.high + summary.medium + summary.low : 0;

  const handleExpand = async () => {
    if (!expanded && contradictions.length === 0) {
      try {
        const res = await intelligenceService.getActiveContradictions();
        if (res.data?.contradictions) setContradictions(res.data.contradictions);
      } catch {
        // Silent fail
      }
    }
    setExpanded(!expanded);
  };

  const handleResolve = async (id: string) => {
    await intelligenceService.resolveContradiction(id);
    setContradictions((prev) => prev.filter((c) => c.id !== id));
    if (summary) setSummary({ ...summary }); // trigger re-render
  };

  const handleDismiss = async (id: string) => {
    await intelligenceService.dismissContradiction(id);
    setContradictions((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading || total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Health Contradictions</h3>
        </div>
        <p className="text-xs text-slate-400">
          {loading ? 'Checking...' : 'No contradictions detected. Your health pillars are aligned!'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5"
    >
      {/* Header */}
      <button onClick={handleExpand} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Health Contradictions</h3>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
            {total}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Severity badges */}
      <div className="flex gap-2 mt-3">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const count = summary?.[sev] ?? 0;
          if (count === 0) return null;
          const colors = SEVERITY_COLORS[sev];
          return (
            <span key={sev} className={`text-[11px] px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
              {count} {sev}
            </span>
          );
        })}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3 space-y-2"
          >
            {contradictions.map((c) => {
              const colors = SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.low;
              return (
                <div key={c.id} className={`p-3 rounded-xl border ${colors.border} ${colors.bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[11px] font-medium uppercase ${colors.text}`}>{c.severity}</span>
                        <span className="text-[11px] text-slate-400">{c.pillarA} vs {c.pillarB}</span>
                      </div>
                      {c.aiCorrection && (
                        <p className="text-xs text-slate-300">{c.aiCorrection}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleResolve(c.id)}
                        className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                        title="Resolve"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                      </button>
                      <button
                        onClick={() => handleDismiss(c.id)}
                        className="p-1 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {contradictions.length === 0 && (
              <p className="text-xs text-slate-400 py-2">Loading details...</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
