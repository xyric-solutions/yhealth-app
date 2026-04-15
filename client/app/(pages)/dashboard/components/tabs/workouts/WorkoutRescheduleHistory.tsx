'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { workoutRescheduleService, type RescheduleHistory } from '@/src/shared/services';
import { ApiError } from '@/lib/api-client';

interface WorkoutRescheduleHistoryProps {
  workoutPlanId?: string;
  limit?: number;
  refreshKey?: number;
}

export function WorkoutRescheduleHistory({
  workoutPlanId,
  limit = 10,
  refreshKey,
}: WorkoutRescheduleHistoryProps) {
  const [history, setHistory] = useState<RescheduleHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setError(null);
      const response = await workoutRescheduleService.getRescheduleHistory(workoutPlanId, limit);
      if (response.success && response.data) {
        setHistory(response.data.history);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load reschedule history');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutPlanId, limit, refreshKey]);

  const getPolicyColor = (policy: RescheduleHistory['policyApplied']) => {
    switch (policy) {
      case 'SLIDE_FORWARD':
        return 'bg-blue-500/20 text-blue-400';
      case 'FILL_GAPS':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'DROP_OR_COMPRESS':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-300">{error}</p>
        <button
          onClick={fetchHistory}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5" />
          Reschedule History
        </h3>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No reschedule history found</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">{formatDate(item.rescheduleDate)}</span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{item.reason}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${getPolicyColor(
                      item.policyApplied
                    )}`}
                  >
                    {item.policyApplied.replace('_', ' ')}
                  </span>
                </div>

                {item.changes && (
                  <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-300">
                          {item.changes.tasksRescheduled} rescheduled
                        </span>
                      </div>
                      {item.changes.tasksDropped > 0 && (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-slate-300">
                            {item.changes.tasksDropped} dropped
                          </span>
                        </div>
                      )}
                    </div>
                    {item.changes.newSchedule && item.changes.newSchedule.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-slate-400 mb-2">Schedule Changes:</div>
                        <div className="space-y-1">
                          {item.changes.newSchedule.slice(0, 3).map((change, idx) => (
                            <div key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                              <RefreshCw className="w-3 h-3" />
                              <span>
                                {new Date(change.oldDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}{' '}
                                →{' '}
                                {new Date(change.newDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          ))}
                          {item.changes.newSchedule.length > 3 && (
                            <div className="text-xs text-slate-500">
                              +{item.changes.newSchedule.length - 3} more changes
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {item.aiSummary && (
                  <div className="mb-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-300">{item.aiSummary}</p>
                    </div>
                  </div>
                )}

                {item.aiFeedback && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-300">{item.aiFeedback}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

