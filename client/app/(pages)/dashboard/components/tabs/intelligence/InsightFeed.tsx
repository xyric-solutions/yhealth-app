'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ThumbsUp, ThumbsDown, Filter, AlertTriangle, CheckCircle, Info, AlertOctagon } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { StructuredInsight } from '@shared/types/domain/intelligence';

type CategoryFilter = 'all' | 'positive' | 'warning' | 'critical' | 'neutral';

const SEVERITY_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  positive: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  neutral: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  critical: { icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-500/20' },
};

export function InsightFeed() {
  const [insights, setInsights] = useState<StructuredInsight[]>([]);
  const [reportDate, setReportDate] = useState<string>('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await intelligenceService.getLatestReport();
        if (!cancelled && res.data?.report) {
          setInsights(res.data.report.insights || []);
          setReportDate(res.data.report.reportDate);
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

  const filtered = filter === 'all' ? insights : insights.filter((i) => i.severity === filter);

  const handleFeedback = useCallback(async (insightId: string, useful: boolean) => {
    if (!reportDate) return;
    try {
      await intelligenceService.submitInsightFeedback(insightId, reportDate, useful);
      setFeedbackGiven((prev) => new Set(prev).add(insightId));
    } catch {
      // Silent fail
    }
  }, [reportDate]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {(['all', 'positive', 'warning', 'critical', 'neutral'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {f} {f !== 'all' && `(${insights.filter((i) => i.severity === f).length})`}
          </button>
        ))}
      </div>

      {/* Insights */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No insights available yet.</p>
          <p className="text-xs text-slate-500 mt-1">Insights are generated from your daily analysis reports.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((insight, idx) => {
            const config = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.neutral;
            const Icon = config.icon;
            const hasFeedback = feedbackGiven.has(insight.id);

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl bg-white/5 border border-white/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white mb-1">{insight.claim}</p>
                    <p className="text-xs text-slate-400 mb-2">{insight.impact}</p>

                    {/* Action */}
                    {insight.action && (
                      <div className="text-xs text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg mb-2">
                        <span className="font-medium">Action:</span> {insight.action}
                      </div>
                    )}

                    {/* Pillar chips */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {insight.pillars_connected?.map((pillar) => (
                        <span key={pillar} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 capitalize">
                          {pillar}
                        </span>
                      ))}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        insight.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        insight.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}>
                        {insight.confidence} confidence
                      </span>
                    </div>

                    {/* Feedback */}
                    {!hasFeedback ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Was this useful?</span>
                        <button
                          onClick={() => handleFeedback(insight.id, true)}
                          className="p-1 rounded-lg hover:bg-emerald-500/20 transition-colors"
                        >
                          <ThumbsUp className="w-3 h-3 text-slate-400 hover:text-emerald-400" />
                        </button>
                        <button
                          onClick={() => handleFeedback(insight.id, false)}
                          className="p-1 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <ThumbsDown className="w-3 h-3 text-slate-400 hover:text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500">Thanks for your feedback!</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
