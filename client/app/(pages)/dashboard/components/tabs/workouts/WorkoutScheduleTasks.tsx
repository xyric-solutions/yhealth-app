'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { workoutRescheduleService, type WorkoutScheduleTask } from '@/src/shared/services';
import { ApiError } from '@/lib/api-client';

interface WorkoutScheduleTasksProps {
  workoutPlanId?: string;
  onTaskClick?: (task: WorkoutScheduleTask) => void;
  refreshKey?: number;
}

export function WorkoutScheduleTasks({ workoutPlanId, onTaskClick, refreshKey }: WorkoutScheduleTasksProps) {
  const [tasks, setTasks] = useState<WorkoutScheduleTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    try {
      setError(null);
      const response = await workoutRescheduleService.getScheduledTasks(workoutPlanId);
      if (response.success && response.data) {
        setTasks(response.data.tasks);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load scheduled tasks');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutPlanId, refreshKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
  };

  const getStatusIcon = (status: WorkoutScheduleTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'missed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'skipped':
        return <XCircle className="w-4 h-4 text-amber-400" />;
      case 'partial':
        return <Activity className="w-4 h-4 text-blue-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: WorkoutScheduleTask['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'missed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'skipped':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'partial':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getIntensityColor = (intensity: WorkoutScheduleTask['intensity']) => {
    switch (intensity) {
      case 'hard':
        return 'bg-red-500/20 text-red-400';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-500/20 text-emerald-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          onClick={handleRefresh}
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
        <h3 className="text-lg font-semibold text-white">Scheduled Tasks</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No scheduled tasks found</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onClick={() => onTaskClick?.(task)}
                className={`p-4 rounded-xl border transition-all ${
                  onTaskClick ? 'cursor-pointer hover:bg-white/5' : ''
                } ${getStatusColor(task.status)}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                      {getStatusIcon(task.status)}
                      <h4 className="font-medium text-sm sm:text-base text-white truncate">{task.name}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(task.scheduledDate)}</span>
                      </div>
                      {task.estimatedDurationMinutes && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{task.estimatedDurationMinutes} min</span>
                        </div>
                      )}
                      {task.muscleGroups.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          <span className="truncate">{task.muscleGroups.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium ${getIntensityColor(
                        task.intensity
                      )}`}
                    >
                      {task.intensity.toUpperCase()}
                    </span>
                    {task.rescheduleCount > 0 && (
                      <span className="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-blue-500/20 text-blue-400">
                        Rescheduled {task.rescheduleCount}x
                      </span>
                    )}
                  </div>
                </div>
                {task.originalScheduledDate &&
                  task.originalScheduledDate !== task.scheduledDate && (
                    <div className="mt-2 text-xs text-slate-500">
                      Originally scheduled for{' '}
                      {new Date(task.originalScheduledDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
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

