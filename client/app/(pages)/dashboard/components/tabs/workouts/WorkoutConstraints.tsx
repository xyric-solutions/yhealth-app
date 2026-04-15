'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  Activity,
} from 'lucide-react';
import { workoutRescheduleService, type UserWorkoutConstraints } from '@/src/shared/services';
import { ApiError } from '@/lib/api-client';

interface WorkoutConstraintsProps {
  onSave?: () => void;
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export function WorkoutConstraints({ onSave }: WorkoutConstraintsProps) {
  const [constraints, setConstraints] = useState<Partial<UserWorkoutConstraints>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchConstraints();
  }, []);

  const fetchConstraints = async () => {
    try {
      setError(null);
      const response = await workoutRescheduleService.getConstraints();
      if (response.success && response.data) {
        setConstraints(response.data.constraints || {});
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load constraints');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await workoutRescheduleService.updateConstraints(constraints);
      if (response.success) {
        setSuccess(true);
        onSave?.();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save constraints');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: string, field: 'availableDays' | 'restDays') => {
    const currentDays = constraints[field] || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    setConstraints({ ...constraints, [field]: newDays });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Workout Constraints
        </h3>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>
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

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <p className="text-sm text-emerald-300">Constraints saved successfully!</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Limits */}
        <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-white/5">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Session Limits
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Max Sessions Per Week
              </label>
              <input
                type="number"
                min="1"
                max="14"
                value={constraints.maxSessionsPerWeek || ''}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    maxSessionsPerWeek: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., 5"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Max Hard Sessions Per Week
              </label>
              <input
                type="number"
                min="0"
                max="7"
                value={constraints.maxHardSessionsPerWeek || ''}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    maxHardSessionsPerWeek: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., 2"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Max Sessions Per Day
              </label>
              <input
                type="number"
                min="1"
                max="3"
                value={constraints.maxSessionsPerDay || ''}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    maxSessionsPerDay: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., 1"
              />
            </div>
          </div>
        </div>

        {/* Rest & Recovery */}
        <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-white/5">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Rest & Recovery
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Min Rest Hours Between Sessions
              </label>
              <input
                type="number"
                min="0"
                max="48"
                value={constraints.minRestHoursBetweenSessions || ''}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    minRestHoursBetweenSessions: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., 24"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Min Rest Hours After Heavy Leg
              </label>
              <input
                type="number"
                min="0"
                max="72"
                value={constraints.minRestHoursAfterHeavyLeg || ''}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    minRestHoursAfterHeavyLeg: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., 48"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="avoidConsecutive"
                checked={constraints.avoidConsecutiveDays || false}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    avoidConsecutiveDays: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded bg-white/5 border-white/10 text-cyan-500 focus:ring-cyan-500"
              />
              <label htmlFor="avoidConsecutive" className="text-sm text-slate-300">
                Avoid Consecutive Days
              </label>
            </div>
          </div>
        </div>

        {/* Available Days */}
        <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-white/5">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Available Days
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isAvailable = constraints.availableDays?.includes(day) || false;
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day, 'availableDays')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isAvailable
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rest Days */}
        <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-white/5">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Rest Days
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isRestDay = constraints.restDays?.includes(day) || false;
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day, 'restDays')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isRestDay
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

