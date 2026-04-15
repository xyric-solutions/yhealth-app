'use client';

import { motion } from 'framer-motion';
import { Clock, Activity, Check, SkipForward, Loader2 } from 'lucide-react';
import type { IActivity } from './types';
import { activityTypeConfig } from './constants';

interface TodayActivityItemProps {
  activity: IActivity;
  planId: string;
  onComplete: (activityId: string) => void;
  onSkip: (activityId: string) => void;
  isUpdating: boolean;
}

export function TodayActivityItem({
  activity,
  onComplete,
  onSkip,
  isUpdating,
}: TodayActivityItemProps) {
  const config = activityTypeConfig[activity.type] || activityTypeConfig.habit;
  const isCompleted = activity.status === 'completed';
  const isSkipped = activity.status === 'skipped';
  const isPending = !isCompleted && !isSkipped;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        isCompleted
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : isSkipped
          ? 'bg-slate-500/10 border-slate-500/30 opacity-60'
          : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isUpdating && isPending) {
            onComplete(activity.id);
          }
        }}
        disabled={isUpdating || !isPending}
        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
          isCompleted
            ? 'bg-emerald-500 border-emerald-500'
            : isSkipped
            ? 'bg-slate-600 border-slate-600'
            : 'border-white/30 hover:border-emerald-400 hover:bg-emerald-500/10'
        } ${isUpdating ? 'opacity-50' : 'cursor-pointer'}`}
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : isCompleted ? (
          <Check className="w-4 h-4 text-white" />
        ) : isSkipped ? (
          <SkipForward className="w-3.5 h-3.5 text-white" />
        ) : null}
      </button>

      {/* Activity Icon */}
      <div
        className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center ${config.color}`}
      >
        {config.icon}
      </div>

      {/* Activity Details */}
      <div className="flex-1 min-w-0">
        <h4
          className={`font-medium ${
            isCompleted || isSkipped ? 'line-through text-slate-400' : 'text-white'
          }`}
        >
          {activity.title}
        </h4>
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {activity.preferredTime}
          </span>
          {activity.duration && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {activity.duration} min
            </span>
          )}
          {activity.isOptional && (
            <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
              Optional
            </span>
          )}
        </div>
      </div>

      {/* Skip Button */}
      {isPending && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isUpdating) {
              onSkip(activity.id);
            }
          }}
          disabled={isUpdating}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Skip
        </button>
      )}

      {/* Status Badge */}
      {isCompleted && (
        <span className="px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/20 rounded-lg">
          Done!
        </span>
      )}
    </motion.div>
  );
}
