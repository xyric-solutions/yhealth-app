'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Calendar,
} from 'lucide-react';
import { workoutRescheduleService, type PlanPolicy } from '@/src/shared/services';
import { ApiError } from '@/lib/api-client';

interface RescheduleWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutPlanId: string;
  onSuccess?: () => void;
}

const POLICY_OPTIONS: Array<{ value: PlanPolicy; label: string; description: string }> = [
  {
    value: 'SLIDE_FORWARD',
    label: 'Slide Forward',
    description: 'Missed tasks shift the entire plan forward',
  },
  {
    value: 'FILL_GAPS',
    label: 'Fill Gaps',
    description: 'Insert missed tasks into empty future slots',
  },
  {
    value: 'DROP_OR_COMPRESS',
    label: 'Drop or Compress',
    description: 'Drop accessories first when too many misses',
  },
];

export function RescheduleWorkoutModal({
  isOpen,
  onClose,
  workoutPlanId,
  onSuccess,
}: RescheduleWorkoutModalProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<PlanPolicy>('FILL_GAPS');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: string; actions: unknown[] } | null>(null);

  const handleReschedule = async () => {
    setIsRescheduling(true);
    setError(null);
    setResult(null);

    try {
      const response = await workoutRescheduleService.triggerReschedule(
        workoutPlanId,
        selectedPolicy
      );
      if (response.success && response.data) {
        setResult({
          summary: response.data.summary,
          actions: response.data.actions,
        });
        onSuccess?.();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to reschedule workouts');
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Reschedule Workouts
            </h3>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-300">Workouts rescheduled successfully!</p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-start gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-300">{result.summary}</p>
                </div>
              </div>
              {result.actions.length > 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-sm font-medium text-white mb-2">Actions Taken:</h4>
                  <div className="space-y-1">
                    {result.actions.slice(0, 5).map((rawAction: unknown, idx: number) => {
                      const action = rawAction as { action?: string; oldDate?: string; newDate?: string; reason?: string };
                      return (
                      <div key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {action.action === 'move' && action.oldDate && action.newDate
                            ? `Moved: ${new Date(action.oldDate).toLocaleDateString()} \u2192 ${new Date(
                                action.newDate
                              ).toLocaleDateString()}`
                            : action.action === 'drop'
                              ? `Dropped: ${action.oldDate ? new Date(action.oldDate).toLocaleDateString() : 'task'}`
                              : action.reason || action.action}
                        </span>
                      </div>
                      );
                    })}
                    {result.actions.length > 5 && (
                      <div className="text-xs text-slate-500">
                        +{result.actions.length - 5} more actions
                      </div>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-300">
                    This will automatically reschedule missed workout tasks based on your constraints
                    and preferences.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Rescheduling Policy
                </label>
                <div className="space-y-2">
                  {POLICY_OPTIONS.map((policy) => (
                    <button
                      key={policy.value}
                      onClick={() => setSelectedPolicy(policy.value)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        selectedPolicy === policy.value
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white">{policy.label}</span>
                        {selectedPolicy === policy.value && (
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{policy.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                >
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </motion.div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isRescheduling}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={isRescheduling}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRescheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reschedule
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

