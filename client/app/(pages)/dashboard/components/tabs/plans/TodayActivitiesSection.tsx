'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronUp, ChevronDown, PartyPopper, Loader2, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import type { TodayActivitiesResponse, ActivityLog, ActivityLogStatus } from './types';
import { TodayActivityItem } from './TodayActivityItem';

interface TodayActivitiesSectionProps {
  onActivityComplete: (message: string) => void;
}

export function TodayActivitiesSection({ onActivityComplete }: TodayActivitiesSectionProps) {
  const [todayData, setTodayData] = useState<TodayActivitiesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [updatingActivity, setUpdatingActivity] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchTodayActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<TodayActivitiesResponse>('/plans/today');
      if (response.success && response.data) {
        setTodayData(response.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setTodayData(null);
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load today's activities");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - request deduplication handles concurrent calls

  const handleComplete = async (activityId: string) => {
    if (!todayData) return;
    setUpdatingActivity(activityId);

    try {
      const response = await api.post<{ log: ActivityLog; feedback?: string }>(
        `/plans/${todayData.planId}/activities/${activityId}/log`,
        { status: 'completed' }
      );

      if (response.success) {
        setTodayData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            completedCount: prev.completedCount + 1,
            activities: prev.activities.map((a) =>
              a.id === activityId
                ? { ...a, status: 'completed' as ActivityLogStatus, log: response.data?.log }
                : a
            ),
          };
        });

        const activity = todayData.activities.find((a) => a.id === activityId);
        onActivityComplete(
          response.data?.feedback || `"${activity?.title}" completed! Keep it up!`
        );
      }
    } catch (err) {
      console.error('Failed to complete activity:', err);
    } finally {
      setUpdatingActivity(null);
    }
  };

  const handleSkip = async (activityId: string) => {
    if (!todayData) return;
    setUpdatingActivity(activityId);

    try {
      await api.post(`/plans/${todayData.planId}/activities/${activityId}/log`, {
        status: 'skipped',
      });

      setTodayData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          activities: prev.activities.map((a) =>
            a.id === activityId ? { ...a, status: 'skipped' as ActivityLogStatus } : a
          ),
        };
      });
    } catch (err) {
      console.error('Failed to skip activity:', err);
    } finally {
      setUpdatingActivity(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  if (!todayData) {
    return null;
  }

  // Show rest day card if it's a rest day
  if (todayData.isRestDay) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl overflow-hidden"
      >
        <div className="p-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 animate-pulse" />
              <Sparkles className="w-12 h-12 text-purple-400 relative z-10" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Rest Day
            </h3>
            <p className="text-slate-300 mb-1 text-lg">Recovery Day</p>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Take time to rest, stretch, and recover. Your body needs this to perform better tomorrow.
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm">
              <span className="text-sm font-medium text-purple-300">Rest, stretch & recover</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (todayData.activities.length === 0) {
    return null;
  }

  const completionPercentage = Math.round(
    (todayData.completedCount / todayData.totalCount) * 100
  );
  const allCompleted = todayData.completedCount === todayData.totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/10 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Today&apos;s Activities</h3>
            <p className="text-sm text-slate-400">
              {todayData.completedCount} of {todayData.totalCount} completed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress Ring */}
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-white/10"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${(completionPercentage / 100) * 126} 126`}
                className={allCompleted ? 'text-emerald-500' : 'text-cyan-500'}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {completionPercentage}%
            </span>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Activities List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              {allCompleted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl"
                >
                  <PartyPopper className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="font-medium text-emerald-400">All done for today!</p>
                    <p className="text-sm text-emerald-400/70">
                      You&apos;ve completed all your activities. Great job!
                    </p>
                  </div>
                </motion.div>
              )}

              {todayData.activities.map((activity) => (
                <TodayActivityItem
                  key={activity.id}
                  activity={activity}
                  planId={todayData.planId}
                  onComplete={handleComplete}
                  onSkip={handleSkip}
                  isUpdating={updatingActivity === activity.id}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
