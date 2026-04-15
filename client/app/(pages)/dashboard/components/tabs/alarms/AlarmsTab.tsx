'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Plus,
  Clock,
  Trash2,
  Edit2,
  X,
  Check,
  Loader2,
  Calendar,
  Music,
  RefreshCw,
  Sparkles,
  Volume2,
  ChevronRight,
  Zap,
  Timer,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { confirm } from '@/components/common/ConfirmDialog';
import { AVAILABLE_SOUNDS, type SoundFile } from '../../../utils/sound.service';

interface WorkoutAlarm {
  id: string;
  title: string;
  message: string | null;
  alarmTime: string;
  daysOfWeek: number[];
  isEnabled: boolean;
  nextTriggerAt: string | null;
  soundEnabled: boolean;
  soundFile: string;
  vibrationEnabled: boolean;
  snoozeMinutes: number;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AlarmsTab() {
  const [alarms, setAlarms] = useState<WorkoutAlarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<WorkoutAlarm | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('Workout Reminder');
  const [formTime, setFormTime] = useState('07:00');
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [formSound, setFormSound] = useState(true);
  const [formSoundFile, setFormSoundFile] = useState<SoundFile>('alarm.wav');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAlarms = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get<{ alarms: WorkoutAlarm[] }>('/alarms');
      if (response.success && response.data) {
        setAlarms(response.data.alarms);
      } else {
        setAlarms([]);
      }
    } catch (err) {
      console.error('Failed to fetch alarms:', err);
      setAlarms([]);
      setError('Failed to load alarms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  const handleToggle = async (alarm: WorkoutAlarm) => {
    try {
      const response = await api.patch<{ alarm: WorkoutAlarm }>(`/alarms/${alarm.id}/toggle`);
      if (response.success && response.data) {
        setAlarms((prev) =>
          prev.map((a) => (a.id === alarm.id ? response.data!.alarm : a))
        );
      }
    } catch (err) {
      console.error('Failed to toggle alarm:', err);
    }
  };

  const handleDelete = async (alarmId: string) => {
    const confirmed = await confirm({
      title: 'Delete Alarm',
      description: 'Are you sure you want to delete this alarm? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      const response = await api.delete(`/alarms/${alarmId}`);
      if (response.success) {
        setAlarms((prev) => prev.filter((a) => a.id !== alarmId));
      }
    } catch (err) {
      console.error('Failed to delete alarm:', err);
    }
  };

  const openAddModal = () => {
    setFormTitle('Workout Reminder');
    setFormTime('07:00');
    setFormDays([1, 2, 3, 4, 5]);
    setFormSound(true);
    setFormSoundFile('alarm.wav');
    setFormMessage('');
    setEditingAlarm(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (alarm: WorkoutAlarm) => {
    setFormTitle(alarm.title);
    setFormTime(alarm.alarmTime);
    setFormDays(alarm.daysOfWeek);
    setFormSound(alarm.soundEnabled);
    setFormSoundFile((alarm.soundFile as SoundFile) || 'alarm.wav');
    setFormMessage(alarm.message || '');
    setEditingAlarm(alarm);
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingAlarm(null);
  };

  const toggleDay = (day: number) => {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = async () => {
    if (formDays.length === 0) {
      alert('Please select at least one day');
      return;
    }

    setIsSubmitting(true);
    try {
      // Normalize time to HH:MM format (remove seconds if present)
      const normalizedTime = formTime.includes(':')
        ? formTime.split(':').slice(0, 2).map(part => part.padStart(2, '0')).join(':')
        : formTime;

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
        console.error('Invalid time format:', formTime, 'normalized to:', normalizedTime);
        setError('Time must be in HH:MM format (e.g., 12:40)');
        setIsSubmitting(false);
        return;
      }

      // Get client's timezone to send with the request
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (editingAlarm) {
        // Update existing
        const response = await api.patch<{ alarm: WorkoutAlarm }>(
          `/alarms/${editingAlarm.id}`,
          {
            title: formTitle,
            message: formMessage || null,
            alarmTime: normalizedTime,
            daysOfWeek: formDays,
            soundEnabled: formSound,
            soundFile: formSoundFile,
            timezone: clientTimezone,
          }
        );
        if (response.success && response.data) {
          setAlarms((prev) =>
            prev.map((a) => (a.id === editingAlarm.id ? response.data!.alarm : a))
          );
        }
      } else {
        // Create new
        const response = await api.post<{ alarm: WorkoutAlarm }>('/alarms', {
          title: formTitle,
          message: formMessage || null,
          alarmTime: normalizedTime,
          daysOfWeek: formDays,
          soundEnabled: formSound,
          soundFile: formSoundFile,
          timezone: clientTimezone,
        });
        if (response.success && response.data) {
          setAlarms((prev) => [...prev, response.data!.alarm]);
        }
      }
      closeModal();
      setError(null); // Clear any previous errors
    } catch (err: unknown) {
      console.error('Failed to save alarm:', err);
      // Extract error message from ApiError or response
      let errorMessage = 'Failed to save alarm. Please try again.';
      const errObj = err as Record<string, unknown>;
      if (errObj?.message && typeof errObj.message === 'string') {
        errorMessage = errObj.message;
      } else if (errObj?.error) {
        errorMessage = typeof errObj.error === 'string' ? errObj.error : ((errObj.error as Record<string, unknown>)?.message as string) || errorMessage;
      } else if ((errObj?.response as Record<string, unknown>)?.data) {
        const respData = (errObj.response as Record<string, unknown>).data as Record<string, unknown>;
        if (respData?.error) {
          errorMessage = typeof respData.error === 'string'
            ? respData.error
            : ((respData.error as Record<string, unknown>)?.message as string) || errorMessage;
        }
      }
      setError(errorMessage);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Every day';
    if (JSON.stringify([...days].sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Weekdays';
    if (JSON.stringify([...days].sort()) === JSON.stringify([0, 6])) return 'Weekends';
    return days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ');
  };

  const formatNextTrigger = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Passed';
    if (diff < 60 * 1000) return 'In less than a minute';
    if (diff < 60 * 60 * 1000) {
      const mins = Math.round(diff / (60 * 1000));
      return `In ${mins} min`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const mins = Math.round((diff % (60 * 60 * 1000)) / (60 * 1000));
      return `In ${hours}h ${mins}m`;
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-violet-600/20 border-t-violet-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Bell className="w-6 h-6 text-violet-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-purple-600/20 border border-violet-500/20 p-4 sm:p-6 lg:p-8"
      >
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-48 sm:h-48 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-600/40">
                <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                Alarms
              </h2>
              <p className="text-violet-300/70 text-xs sm:text-sm mt-0.5 sm:mt-1">
                Manage your workout reminders and alarms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  const response = await api.post<{ updated: number }>('/alarms/recalculate');
                  if (response.success) {
                    alert(`Recalculated ${response.data?.updated || 0} alarms`);
                    fetchAlarms();
                  }
                } catch (err) {
                  console.error('Failed to recalculate alarms:', err);
                  alert('Failed to recalculate alarms');
                }
              }}
              className="group px-3 py-2 sm:px-4 sm:py-2.5 bg-white/5 hover:bg-violet-600/20 border border-violet-500/30 hover:border-violet-500/50 text-violet-300 hover:text-violet-200 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
              title="Recalculate alarm trigger times"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="hidden sm:inline">Recalculate</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openAddModal}
              className="px-4 py-2 sm:px-6 sm:py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-600/30 hover:shadow-violet-500/40 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Alarm</span>
            </motion.button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-400">
              <span className="text-white font-medium">{alarms.filter(a => a.isEnabled).length}</span> active
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400">
              <span className="text-white font-medium">{alarms.filter(a => !a.isEnabled).length}</span> inactive
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-violet-300">
            <Timer className="w-4 h-4" />
            <span>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        </div>
      </motion.div>

      {/* Alarms Grid */}
      {alarms.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden text-center py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl sm:rounded-3xl border border-slate-700/30"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_70%)]" />
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center border border-violet-500/20">
              <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-violet-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No alarms set</h3>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto text-sm sm:text-base px-4">
              Create your first alarm to stay on track with your workout schedule
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openAddModal}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-600/30 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Your First Alarm
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          {alarms.map((alarm, index) => (
            <motion.div
              key={alarm.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                alarm.isEnabled
                  ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-violet-500/30 hover:border-violet-500/50 shadow-lg hover:shadow-violet-500/10'
                  : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50 opacity-70'
              }`}
            >
              {/* Glow effect for active alarms */}
              {alarm.isEnabled && (
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-purple-600/5 pointer-events-none" />
              )}

              <div className="relative p-4 sm:p-5">
                {/* Top row: Time and toggle */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
                      alarm.isEnabled
                        ? 'bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-600/30'
                        : 'bg-slate-700/50'
                    }`}>
                      <span className={`text-lg sm:text-xl font-bold ${alarm.isEnabled ? 'text-white' : 'text-slate-400'}`}>
                        {alarm.alarmTime.split(':')[0]}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${alarm.isEnabled ? 'text-white' : 'text-slate-400'}`}>
                          {formatTime(alarm.alarmTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs sm:text-sm font-medium ${alarm.isEnabled ? 'text-violet-300' : 'text-slate-500'}`}>
                          {alarm.title}
                        </span>
                        {alarm.isEnabled && (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] sm:text-xs font-medium">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggle(alarm)}
                      className={`p-2 sm:p-2.5 rounded-xl transition-all ${
                        alarm.isEnabled
                          ? 'bg-violet-600/20 hover:bg-violet-600/30 text-violet-400'
                          : 'bg-slate-700/50 hover:bg-slate-700 text-slate-400'
                      }`}
                      title={alarm.isEnabled ? 'Disable' : 'Enable'}
                    >
                      {alarm.isEnabled ? (
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <BellOff className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => openEditModal(alarm)}
                      className="p-2 sm:p-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(alarm.id)}
                      className="p-2 sm:p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.button>
                  </div>
                </div>

                {/* Message if exists */}
                {alarm.message && (
                  <p className="text-slate-400 text-xs sm:text-sm mb-3 line-clamp-1">{alarm.message}</p>
                )}

                {/* Info row */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
                    <span>{formatDays(alarm.daysOfWeek)}</span>
                  </div>

                  {alarm.soundEnabled && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
                      <span>
                        {AVAILABLE_SOUNDS.find((s) => s.value === alarm.soundFile)?.label || alarm.soundFile}
                      </span>
                    </div>
                  )}

                  {alarm.nextTriggerAt && alarm.isEnabled && (
                    <div className="flex items-center gap-1.5 text-violet-300">
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="font-medium">{formatNextTrigger(alarm.nextTriggerAt)}</span>
                    </div>
                  )}
                </div>

                {/* Day indicators */}
                <div className="flex gap-1 sm:gap-1.5">
                  {DAY_LABELS.map((label, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 h-8 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                        alarm.daysOfWeek.includes(idx)
                          ? alarm.isEnabled
                            ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-md shadow-violet-600/20'
                            : 'bg-slate-700 text-slate-400'
                          : 'bg-slate-800/50 text-slate-600'
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Modal glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-3xl blur-xl opacity-20" />

                <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl sm:rounded-3xl border border-violet-500/20 shadow-2xl shadow-violet-600/10 overflow-hidden">
                  {/* Header */}
                  <div className="relative px-4 sm:px-6 py-4 sm:py-5 border-b border-violet-500/10">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-purple-600/10" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
                          {editingAlarm ? <Edit2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-white">
                            {editingAlarm ? 'Edit Alarm' : 'Create Alarm'}
                          </h3>
                          <p className="text-violet-300/60 text-xs sm:text-sm">
                            {editingAlarm ? 'Modify your alarm settings' : 'Set up a new workout reminder'}
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={closeModal}
                        className="p-2 sm:p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[60vh] overflow-y-auto">
                    {/* Time Input */}
                    <div>
                      <label className="block text-sm font-medium text-violet-300 mb-2">
                        Alarm Time
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
                        <input
                          type="time"
                          value={formTime}
                          onChange={(e) => setFormTime(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 sm:py-4 bg-slate-800/50 border border-violet-500/20 hover:border-violet-500/40 focus:border-violet-500 rounded-xl sm:rounded-2xl text-white text-xl sm:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                        />
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-violet-300 mb-2">
                        Alarm Name
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full px-4 py-2.5 sm:py-3 bg-slate-800/50 border border-violet-500/20 hover:border-violet-500/40 focus:border-violet-500 rounded-xl sm:rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                        placeholder="Workout Reminder"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium text-violet-300 mb-2">
                        Message <span className="text-slate-500">(Optional)</span>
                      </label>
                      <textarea
                        value={formMessage}
                        onChange={(e) => setFormMessage(e.target.value)}
                        className="w-full px-4 py-2.5 sm:py-3 bg-slate-800/50 border border-violet-500/20 hover:border-violet-500/40 focus:border-violet-500 rounded-xl sm:rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none transition-all"
                        placeholder="Time for your workout!"
                        rows={2}
                      />
                    </div>

                    {/* Days */}
                    <div>
                      <label className="block text-sm font-medium text-violet-300 mb-2">
                        Repeat Days
                      </label>
                      <div className="flex gap-1.5 sm:gap-2">
                        {DAY_NAMES.map((name, index) => (
                          <motion.button
                            key={index}
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleDay(index)}
                            className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                              formDays.includes(index)
                                ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/30'
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-violet-500/10'
                            }`}
                          >
                            {DAY_LABELS[index]}
                          </motion.button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {formDays.length === 7
                          ? 'Every day'
                          : formDays.length === 5 && !formDays.includes(0) && !formDays.includes(6)
                          ? 'Weekdays'
                          : formDays.length === 2 && formDays.includes(0) && formDays.includes(6)
                          ? 'Weekends'
                          : formDays.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ') || 'Select days'}
                      </p>
                    </div>

                    {/* Sound */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-violet-300">Sound</label>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormSound(!formSound)}
                          className={`relative w-12 h-7 rounded-full transition-all ${
                            formSound
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-lg shadow-violet-600/30'
                              : 'bg-slate-700'
                          }`}
                        >
                          <motion.div
                            animate={{ x: formSound ? 20 : 2 }}
                            className="absolute top-1 left-0 w-5 h-5 rounded-full bg-white shadow-md"
                          />
                        </motion.button>
                      </div>

                      <AnimatePresence>
                        {formSound && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <div className="relative">
                              <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                              <select
                                value={formSoundFile}
                                onChange={(e) => setFormSoundFile(e.target.value as SoundFile)}
                                className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-violet-500/20 rounded-xl sm:rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                              >
                                {AVAILABLE_SOUNDS.map((sound) => (
                                  <option key={sound.value} value={sound.value} className="bg-slate-900">
                                    {sound.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 rotate-90" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2"
                        >
                          <X className="w-4 h-4 flex-shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Actions */}
                  <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-violet-500/10 bg-slate-900/50">
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={closeModal}
                        className="flex-1 px-4 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl sm:rounded-2xl transition-colors"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg shadow-violet-600/30 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            <span className="text-sm sm:text-base">Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-sm sm:text-base">{editingAlarm ? 'Update' : 'Create'}</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
