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
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { AVAILABLE_SOUNDS, type SoundFile } from '../../utils/sound.service';
import { confirm } from '@/components/common/ConfirmDialog';

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
}

interface AlarmSummary {
  totalAlarms: number;
  enabledAlarms: number;
  nextAlarm: WorkoutAlarm | null;
  todayAlarms: WorkoutAlarm[];
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WorkoutAlarmsWidget() {
  const [alarms, setAlarms] = useState<WorkoutAlarm[]>([]);
  const [summary, setSummary] = useState<AlarmSummary | null>(null);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    let hasNetworkError = false;
    try {
      const [alarmsRes, summaryRes] = await Promise.all([
        api.get<{ alarms: WorkoutAlarm[] }>('/alarms').catch((err) => {
          console.error('Failed to fetch alarms list:', err);
          // Check if it's a network error
          if (err instanceof Error && (err.message.includes('Network error') || err.message.includes('NETWORK_ERROR') || (err as { code?: string }).code === 'NETWORK_ERROR')) {
            hasNetworkError = true;
          }
          return { success: false, data: { alarms: [] } };
        }),
        api.get<{ summary: AlarmSummary }>('/alarms/summary').catch((err) => {
          console.error('Failed to fetch alarms summary:', err);
          // Check if it's a network error
          if (err instanceof Error && (err.message.includes('Network error') || err.message.includes('NETWORK_ERROR') || (err as { code?: string }).code === 'NETWORK_ERROR')) {
            hasNetworkError = true;
          }
          return { success: false, data: { summary: null } };
        }),
      ]);
      
      if (hasNetworkError) {
        setError('Unable to connect to server. Please check if the server is running at http://localhost:5000/api');
      }

      if (alarmsRes.success && alarmsRes.data) {
        setAlarms(alarmsRes.data.alarms);
      } else {
        setAlarms([]);
      }
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data.summary);
      } else {
        setSummary(null);
      }
    } catch (err) {
      console.error('Failed to fetch alarms:', err);
      setAlarms([]);
      setSummary(null);
      if (err instanceof Error && (err.message.includes('Network error') || err.message.includes('NETWORK_ERROR'))) {
        setError('Unable to connect to server. Please check if the server is running.');
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    // Ensure API client is initialized
    if (typeof window !== 'undefined') {
      api.initFromCookie();
    }
    fetchData();
  }, [fetchData]);

  const handleToggle = async (alarm: WorkoutAlarm) => {
    try {
      const response = await api.patch<{ alarm: WorkoutAlarm }>(`/alarms/${alarm.id}/toggle`);
      if (response.success && response.data) {
        setAlarms((prev) =>
          prev.map((a) => (a.id === alarm.id ? response.data!.alarm : a))
        );
        fetchData(); // Refresh summary
      }
    } catch (err) {
      console.error('Failed to toggle alarm:', err);
    }
  };

  const handleDelete = async (alarmId: string) => {
    const confirmed = await confirm({
      title: "Delete Alarm",
      description: "Are you sure you want to delete this alarm?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const response = await api.delete(`/alarms/${alarmId}`);
      if (response.success) {
        setAlarms((prev) => prev.filter((a) => a.id !== alarmId));
        fetchData(); // Refresh summary
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
    setEditingAlarm(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (alarm: WorkoutAlarm) => {
    setFormTitle(alarm.title);
    setFormTime(alarm.alarmTime);
    setFormDays(alarm.daysOfWeek);
    setFormSound(alarm.soundEnabled);
    setFormSoundFile((alarm.soundFile as SoundFile) || 'alarm.wav');
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
      // Normalize time to HH:MM format (24-hour format)
      // HTML time input should already return HH:MM, but normalize to be safe
      const normalizedTime = formTime.includes(':') 
        ? formTime.split(':').slice(0, 2).map(part => part.padStart(2, '0')).join(':')
        : formTime;
      
      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
        alert('Time must be in HH:MM format (e.g., 13:30)');
        setIsSubmitting(false);
        return;
      }

      if (editingAlarm) {
        // Update existing
        const response = await api.patch<{ alarm: WorkoutAlarm }>(
          `/alarms/${editingAlarm.id}`,
          {
            title: formTitle,
            alarmTime: normalizedTime,
            daysOfWeek: formDays,
            soundEnabled: formSound,
            soundFile: formSoundFile,
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
          alarmTime: normalizedTime,
          daysOfWeek: formDays,
          soundEnabled: formSound,
          soundFile: formSoundFile,
        });
        if (response.success && response.data) {
          setAlarms((prev) => [...prev, response.data!.alarm]);
        }
      }
      closeModal();
      fetchData(); // Refresh summary
    } catch (err) {
      console.error('Failed to save alarm:', err);
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

  const formatNextTrigger = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Passed';
    if (diff < 60 * 60 * 1000) {
      const mins = Math.round(diff / (60 * 1000));
      return `In ${mins} min`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.round(diff / (60 * 60 * 1000));
      return `In ${hours}h`;
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 border border-red-500/20 rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-red-400 font-medium mb-2">Connection Error</p>
            <p className="text-slate-400 text-sm mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-500/10 via-emerald-600/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl overflow-hidden shadow-lg shadow-emerald-500/10"
      >
        {/* Header */}
        <div className="p-4 border-b border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-600">Workout Reminders</h3>
                <p className="text-xs text-slate-400">
                  {summary?.enabledAlarms || 0} active alarm{(summary?.enabledAlarms || 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Next Alarm */}
        {summary?.nextAlarm && (
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm text-white font-medium">Next: {summary.nextAlarm.title}</p>
                <p className="text-xs text-emerald-400">
                  {formatNextTrigger(summary.nextAlarm.nextTriggerAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alarms List */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {alarms.length === 0 ? (
            <div className="text-center py-6">
              <Bell className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
              <p className="text-slate-400 text-sm">No alarms set</p>
              <button
                onClick={openAddModal}
                className="mt-3 text-emerald-600 text-sm hover:underline font-medium"
              >
                Add your first alarm
              </button>
            </div>
          ) : (
            alarms.map((alarm) => (
              <motion.div
                key={alarm.id}
                layout
                className={`p-3 rounded-xl border transition-colors ${
                  alarm.isEnabled
                    ? 'bg-white/5 border-emerald-500/20'
                    : 'bg-white/2 border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatTime(alarm.alarmTime)}
                    </span>
                    <span className="text-sm text-slate-400">{alarm.title}</span>
                  </div>
                  <button
                    onClick={() => handleToggle(alarm)}
                    className={`p-2 rounded-lg transition-colors ${
                      alarm.isEnabled
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {alarm.isEnabled ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Days */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {DAY_LABELS.map((label, idx) => (
                      <span
                        key={idx}
                        className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                          alarm.daysOfWeek.includes(idx)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-slate-600'
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(alarm)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(alarm.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-emerald-600">
                  {editingAlarm ? 'Edit Alarm' : 'New Alarm'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Time Input */}
              <div className="mb-6">
                <label className="block text-sm text-emerald-400 mb-2">Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-emerald-500/30 rounded-xl text-emerald-600 text-2xl text-center font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Title Input */}
              <div className="mb-6">
                <label className="block text-sm text-emerald-400 mb-2">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Workout Reminder"
                  className="w-full px-4 py-2 bg-white/5 border border-emerald-500/30 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Days Selection */}
              <div className="mb-6">
                <label className="block text-sm text-emerald-400 mb-2">Repeat</label>
                <div className="flex gap-2">
                  {DAY_NAMES.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formDays.includes(idx)
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-white/5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                      }`}
                    >
                      {DAY_LABELS[idx]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {formDays.length === 7
                    ? 'Every day'
                    : formDays.length === 5 && !formDays.includes(0) && !formDays.includes(6)
                    ? 'Weekdays'
                    : formDays.length === 2 && formDays.includes(0) && formDays.includes(6)
                    ? 'Weekends'
                    : formDays.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}
                </p>
              </div>

              {/* Sound Toggle */}
              <div className="mb-6 space-y-3">
                <button
                  onClick={() => setFormSound(!formSound)}
                  className="flex items-center justify-between w-full p-3 bg-white/5 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                >
                  <span className="text-emerald-400 font-medium">Sound</span>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors ${
                      formSound ? 'bg-emerald-600 shadow-lg shadow-emerald-500/40' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${
                        formSound ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </button>
                {formSound && (
                  <div>
                    <label className="block text-sm text-emerald-400 mb-2">Sound File</label>
                    <select
                      value={formSoundFile}
                      onChange={(e) => setFormSoundFile(e.target.value as SoundFile)}
                      className="w-full px-4 py-2 bg-white/5 border border-emerald-500/30 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {AVAILABLE_SOUNDS.map((sound) => (
                        <option key={sound.value} value={sound.value}>
                          {sound.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || formDays.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {editingAlarm ? 'Save Changes' : 'Create Alarm'}
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
