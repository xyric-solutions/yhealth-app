'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp, Calendar, TrendingUp } from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import type { WeeklyReport, WeeklyHistoryItem } from '@shared/types/domain/intelligence';

export function ReportViewer() {
  const [history, setHistory] = useState<WeeklyHistoryItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [historyRes, latestRes] = await Promise.all([
          intelligenceService.getWeeklyHistory(12),
          intelligenceService.getWeeklyReport(),
        ]);
        if (!cancelled) {
          if (historyRes.data?.history) setHistory(historyRes.data.history);
          if (latestRes.data?.report) setSelectedReport(latestRes.data.report);
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

  const handleViewReport = async (weekEnd: string) => {
    if (expandedId === weekEnd) {
      setExpandedId(null);
      return;
    }
    setExpandedId(weekEnd);
    try {
      const res = await intelligenceService.getWeeklyReport(weekEnd);
      if (res.data?.report) setSelectedReport(res.data.report);
    } catch {
      // Silent fail
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (trend === 'declining') return <TrendingUp className="w-3 h-3 text-red-400 rotate-180" />;
    return <TrendingUp className="w-3 h-3 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Latest Report */}
      {selectedReport && expandedId === null && (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Latest Weekly Report</h3>
            <span className="text-xs text-slate-400">Week ending {selectedReport.weekEndDate}</span>
          </div>

          {/* Narrative */}
          {selectedReport.narrative && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-200 leading-relaxed">{selectedReport.narrative}</p>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] text-slate-400 block">Avg Score</span>
              <span className="text-xl font-bold text-white">{selectedReport.summary.avgTotalScore}</span>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] text-slate-400 block">Trend</span>
              <div className="flex items-center gap-1">
                {getTrendIcon(selectedReport.summary.scoreTrend)}
                <span className="text-sm font-medium text-white capitalize">{selectedReport.summary.scoreTrend}</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] text-slate-400 block">Reports</span>
              <span className="text-xl font-bold text-white">{selectedReport.summary.dailyReportCount}/7</span>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] text-slate-400 block">Insights</span>
              <span className="text-xl font-bold text-white">{selectedReport.summary.totalInsightsCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Weekly Reports</h3>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No weekly reports available yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item, idx) => (
              <motion.div key={item.weekEndDate} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}>
                <button
                  onClick={() => handleViewReport(item.weekEndDate)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 font-medium">{item.weekEndDate}</span>
                    <span className="text-xs text-slate-400">{item.reportCount} reports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{item.avgScore.toFixed(0)}</span>
                    {expandedId === item.weekEndDate ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === item.weekEndDate && selectedReport?.weekEndDate === item.weekEndDate && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 mt-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        {selectedReport.narrative && (
                          <p className="text-sm text-slate-200 leading-relaxed">{selectedReport.narrative}</p>
                        )}
                        <div className="flex gap-3 mt-3 text-xs text-slate-400">
                          <span>Score: {selectedReport.summary.avgTotalScore}</span>
                          <span>Trend: {selectedReport.summary.scoreTrend}</span>
                          <span>Insights: {selectedReport.summary.totalInsightsCount}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
