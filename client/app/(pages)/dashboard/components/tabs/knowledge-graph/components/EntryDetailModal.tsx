'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Dumbbell, Utensils, Smile, Moon, Heart, Zap, Target, Brain,
  BookOpen, AlertTriangle, TrendingUp, Phone, Droplets, Gauge, Flame,
  CheckCircle2, Clock, Star, Wind, Flower2, Mic, ScanFace, Sunrise,
  BarChart3, HeartPulse, MessageCircle, CheckSquare, CalendarClock,
  Wallet, Trophy, Landmark, Calendar, Activity,
} from 'lucide-react';
import type { GraphNode, GraphNodeType, GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../constants/graph-config';

// ── Icon map ──────────────────────────────────────────────────────
const TYPE_ICONS: Partial<Record<GraphNodeType, React.ReactNode>> = {
  workout_session: <Dumbbell className="w-5 h-5" />,
  meal: <Utensils className="w-5 h-5" />,
  mood_entry: <Smile className="w-5 h-5" />,
  sleep_session: <Moon className="w-5 h-5" />,
  recovery_score: <Heart className="w-5 h-5" />,
  strain_score: <Flame className="w-5 h-5" />,
  energy_log: <Zap className="w-5 h-5" />,
  stress_log: <AlertTriangle className="w-5 h-5" />,
  health_goal: <Target className="w-5 h-5" />,
  life_goal: <Star className="w-5 h-5" />,
  daily_score: <Gauge className="w-5 h-5" />,
  journal_entry: <BookOpen className="w-5 h-5" />,
  contradiction: <AlertTriangle className="w-5 h-5" />,
  correlation: <TrendingUp className="w-5 h-5" />,
  habit_completion: <CheckCircle2 className="w-5 h-5" />,
  voice_call: <Phone className="w-5 h-5" />,
  water_intake: <Droplets className="w-5 h-5" />,
  insight: <Brain className="w-5 h-5" />,
  daily_checkin: <Clock className="w-5 h-5" />,
  breathing_test: <Wind className="w-5 h-5" />,
  yoga_session: <Flower2 className="w-5 h-5" />,
  meditation_session: <Brain className="w-5 h-5" />,
  voice_journal: <Mic className="w-5 h-5" />,
  emotion_detection: <ScanFace className="w-5 h-5" />,
  progress_record: <TrendingUp className="w-5 h-5" />,
  daily_intention: <Sunrise className="w-5 h-5" />,
  weekly_report: <BarChart3 className="w-5 h-5" />,
  emotional_screening: <HeartPulse className="w-5 h-5" />,
  nutrition_pattern: <Utensils className="w-5 h-5" />,
  chat_message: <MessageCircle className="w-5 h-5" />,
  activity_completion: <CheckSquare className="w-5 h-5" />,
  schedule_entry: <CalendarClock className="w-5 h-5" />,
  finance_transaction: <Wallet className="w-5 h-5" />,
  achievement: <Trophy className="w-5 h-5" />,
  finance_insight: <Landmark className="w-5 h-5" />,
};

// ── Helpers ────────────────────────────────────────────────────────
interface DetailField {
  label: string;
  value: string | number;
  highlight?: boolean; // show as accent color
  icon?: React.ReactNode;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function getEntryDetails(entry: GraphNode): { fields: DetailField[]; summary?: string } {
  const d = entry.data as Record<string, unknown>;

  switch (entry.type) {
    case 'meal': {
      const fields: DetailField[] = [];
      if (d.mealType) fields.push({ label: 'Meal Type', value: fmt(d.mealType), icon: <Clock className="w-3.5 h-3.5" /> });
      if (d.calories) fields.push({ label: 'Calories', value: `${d.calories} kcal`, highlight: true, icon: <Flame className="w-3.5 h-3.5" /> });
      if (d.proteinGrams) fields.push({ label: 'Protein', value: `${d.proteinGrams}g`, icon: <Activity className="w-3.5 h-3.5" /> });
      if (d.carbsGrams) fields.push({ label: 'Carbs', value: `${d.carbsGrams}g`, icon: <Zap className="w-3.5 h-3.5" /> });
      if (d.fatGrams) fields.push({ label: 'Fat', value: `${d.fatGrams}g`, icon: <Droplets className="w-3.5 h-3.5" /> });
      if (d.healthScore) fields.push({ label: 'Health Score', value: `${d.healthScore}/100`, highlight: true });
      if (d.eatenAt) fields.push({ label: 'Time', value: new Date(String(d.eatenAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), icon: <Calendar className="w-3.5 h-3.5" /> });
      return { fields };
    }

    case 'workout_session': {
      const fields: DetailField[] = [];
      if (d.workoutName) fields.push({ label: 'Workout', value: fmt(d.workoutName) });
      if (d.durationMinutes) fields.push({ label: 'Duration', value: `${d.durationMinutes} min`, icon: <Clock className="w-3.5 h-3.5" /> });
      if (d.status) fields.push({ label: 'Status', value: fmt(d.status), highlight: d.status === 'completed' });
      if (d.totalVolume) fields.push({ label: 'Total Volume', value: `${d.totalVolume} kg` });
      if (d.difficultyRating) fields.push({ label: 'Difficulty', value: `${d.difficultyRating}/10` });
      if (d.energyLevel) fields.push({ label: 'Energy', value: `${d.energyLevel}/10`, icon: <Zap className="w-3.5 h-3.5" /> });
      if (d.moodAfter) fields.push({ label: 'Mood After', value: `${d.moodAfter}/10`, icon: <Smile className="w-3.5 h-3.5" /> });
      if (d.xpEarned) fields.push({ label: 'XP Earned', value: `+${d.xpEarned} XP`, highlight: true, icon: <Star className="w-3.5 h-3.5" /> });
      return { fields };
    }

    case 'mood_entry': {
      const fields: DetailField[] = [];
      if (d.moodEmoji) fields.push({ label: 'Mood', value: fmt(d.moodEmoji) });
      if (d.happinessRating) fields.push({ label: 'Happiness', value: `${d.happinessRating}/10`, icon: <Smile className="w-3.5 h-3.5" /> });
      if (d.energyRating) fields.push({ label: 'Energy', value: `${d.energyRating}/10`, icon: <Zap className="w-3.5 h-3.5" /> });
      if (d.stressRating) fields.push({ label: 'Stress', value: `${d.stressRating}/10`, icon: <AlertTriangle className="w-3.5 h-3.5" /> });
      if (d.anxietyRating) fields.push({ label: 'Anxiety', value: `${d.anxietyRating}/10` });
      if (Array.isArray(d.emotionTags) && d.emotionTags.length) fields.push({ label: 'Tags', value: d.emotionTags.join(', ') });
      return { fields };
    }

    case 'sleep_session': {
      const fields: DetailField[] = [];
      const hrs = d.sleepHours != null ? parseFloat(String(d.sleepHours)) : NaN;
      if (!isNaN(hrs)) fields.push({ label: 'Sleep Duration', value: `${hrs.toFixed(1)} hours`, highlight: true, icon: <Moon className="w-3.5 h-3.5" /> });
      if (d.provider) fields.push({ label: 'Source', value: fmt(d.provider) });
      if (d.qualityScore != null) fields.push({ label: 'Quality', value: `${d.qualityScore}%`, highlight: true });
      if (d.efficiencyPercent != null) fields.push({ label: 'Efficiency', value: `${d.efficiencyPercent}%` });
      if (d.consistencyPercent != null) fields.push({ label: 'Consistency', value: `${d.consistencyPercent}%` });
      if (d.respiratoryRate != null) fields.push({ label: 'Respiratory Rate', value: `${d.respiratoryRate} rpm` });
      const stages = d.stages as Record<string, number> | null | undefined;
      if (stages) {
        if (stages.remMinutes) fields.push({ label: 'REM', value: `${stages.remMinutes} min` });
        if (stages.deepMinutes) fields.push({ label: 'Deep', value: `${stages.deepMinutes} min` });
        if (stages.lightMinutes) fields.push({ label: 'Light', value: `${stages.lightMinutes} min` });
        if (stages.awakeMinutes) fields.push({ label: 'Awake', value: `${stages.awakeMinutes} min` });
      }
      return { fields };
    }

    case 'recovery_score': {
      const fields: DetailField[] = [];
      fields.push({ label: 'Recovery', value: `${d.recoveryScore}%`, highlight: true, icon: <Heart className="w-3.5 h-3.5" /> });
      if (d.hrvRmssd != null) fields.push({ label: 'HRV (RMSSD)', value: `${d.hrvRmssd} ms` });
      if (d.restingHeartRate != null) fields.push({ label: 'Resting HR', value: `${d.restingHeartRate} bpm`, icon: <HeartPulse className="w-3.5 h-3.5" /> });
      if (d.spo2Percent != null) fields.push({ label: 'SpO2', value: `${d.spo2Percent}%` });
      if (d.skinTempCelsius != null) fields.push({ label: 'Skin Temp', value: `${d.skinTempCelsius}°C` });
      return { fields };
    }

    case 'strain_score':
      return { fields: [{ label: 'Strain', value: `${d.strainScore}`, highlight: true, icon: <Flame className="w-3.5 h-3.5" /> }] };

    case 'daily_score': {
      const fields: DetailField[] = [{ label: 'Total Score', value: `${d.totalScore}/100`, highlight: true, icon: <Gauge className="w-3.5 h-3.5" /> }];
      const components = d.componentScores as Record<string, number> | null | undefined;
      if (components) {
        Object.entries(components).forEach(([k, v]) => {
          fields.push({ label: k.charAt(0).toUpperCase() + k.slice(1), value: String(v) });
        });
      }
      if (d.explanation) return { fields, summary: String(d.explanation) };
      return { fields };
    }

    case 'water_intake':
      return {
        fields: [
          { label: 'Consumed', value: `${d.glassesConsumed} glasses`, icon: <Droplets className="w-3.5 h-3.5" /> },
          { label: 'Target', value: `${d.targetGlasses} glasses`, icon: <Target className="w-3.5 h-3.5" /> },
          { label: 'Status', value: d.goalAchieved ? 'Goal Achieved' : 'In Progress', highlight: !!d.goalAchieved },
        ],
      };

    case 'journal_entry': {
      const fields: DetailField[] = [];
      if (d.promptCategory) fields.push({ label: 'Category', value: fmt(d.promptCategory) });
      if (d.wordCount) fields.push({ label: 'Word Count', value: `${d.wordCount} words`, icon: <BookOpen className="w-3.5 h-3.5" /> });
      if (d.sentimentLabel) fields.push({ label: 'Sentiment', value: fmt(d.sentimentLabel), highlight: true });
      if (d.sentimentScore != null) fields.push({ label: 'Sentiment Score', value: fmt(d.sentimentScore) });
      return { fields };
    }

    case 'stress_log':
      return {
        fields: [
          { label: 'Stress Rating', value: `${d.stressRating}/10`, highlight: true, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          ...(d.finalStressScore != null ? [{ label: 'Final Score', value: String(d.finalStressScore) }] : []),
          ...(d.checkInType ? [{ label: 'Check-In Type', value: fmt(d.checkInType) }] : []),
          ...(Array.isArray(d.triggers) && d.triggers.length ? [{ label: 'Triggers', value: d.triggers.join(', ') }] : []),
        ],
      };

    case 'energy_log':
      return {
        fields: [
          { label: 'Energy', value: `${d.energyRating}/10`, highlight: true, icon: <Zap className="w-3.5 h-3.5" /> },
          ...(d.contextTag ? [{ label: 'Context', value: fmt(d.contextTag) }] : []),
        ],
      };

    case 'daily_checkin':
      return {
        fields: [
          ...(d.moodScore ? [{ label: 'Mood', value: `${d.moodScore}/10`, icon: <Smile className="w-3.5 h-3.5" /> as React.ReactNode }] : []),
          ...(d.energyScore ? [{ label: 'Energy', value: `${d.energyScore}/10`, icon: <Zap className="w-3.5 h-3.5" /> as React.ReactNode }] : []),
          ...(d.stressScore ? [{ label: 'Stress', value: `${d.stressScore}/10`, icon: <AlertTriangle className="w-3.5 h-3.5" /> as React.ReactNode }] : []),
        ],
      };

    case 'health_goal':
    case 'life_goal':
      return {
        fields: [
          ...(d.category ? [{ label: 'Category', value: fmt(d.category) }] : []),
          ...(d.progress !== undefined ? [{ label: 'Progress', value: `${d.progress}%`, highlight: true, icon: <Target className="w-3.5 h-3.5" /> as React.ReactNode }] : []),
          ...(d.status ? [{ label: 'Status', value: fmt(d.status) }] : []),
        ],
      };

    case 'habit_completion':
      return {
        fields: [
          ...(d.habitName ? [{ label: 'Habit', value: fmt(d.habitName) }] : []),
          { label: 'Status', value: d.completed ? 'Completed' : 'Missed', highlight: !!d.completed, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
          ...(d.category ? [{ label: 'Category', value: fmt(d.category) }] : []),
        ],
      };

    default: {
      // Generic: show all non-object fields
      const fields = Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
        .slice(0, 8)
        .map(([k, v]) => ({
          label: k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim(),
          value: String(v),
        }));
      return { fields };
    }
  }
}

// ── Macros Ring (for meals) ──────────────────────────────────────
function MacrosRing({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein + carbs + fat;
  if (total === 0) return null;
  const pPct = (protein / total) * 100;
  const cPct = (carbs / total) * 100;
  const fPct = (fat / total) * 100;

  return (
    <div className="flex items-center gap-4 mt-3">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3B82F6" strokeWidth="3"
            strokeDasharray={`${pPct} ${100 - pPct}`} strokeDashoffset="0" strokeLinecap="round" />
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F59E0B" strokeWidth="3"
            strokeDasharray={`${cPct} ${100 - cPct}`} strokeDashoffset={`${-pPct}`} strokeLinecap="round" />
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EF4444" strokeWidth="3"
            strokeDasharray={`${fPct} ${100 - fPct}`} strokeDashoffset={`${-(pPct + cPct)}`} strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-400">Protein</span>
          <span className="text-white font-semibold ml-auto">{protein}g</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-400">Carbs</span>
          <span className="text-white font-semibold ml-auto">{carbs}g</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-slate-400">Fat</span>
          <span className="text-white font-semibold ml-auto">{fat}g</span>
        </div>
      </div>
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-1">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
interface EntryDetailModalProps {
  entry: GraphNode | null;
  onClose: () => void;
}

export function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
  const { fields, summary } = useMemo(() => {
    if (!entry) return { fields: [], summary: undefined };
    return getEntryDetails(entry);
  }, [entry]);

  const color = entry ? (CATEGORY_COLORS[entry.category] || '#94A3B8') : '#94A3B8';
  const icon = entry ? (TYPE_ICONS[entry.type] || <Brain className="w-5 h-5" />) : null;
  const d = (entry?.data || {}) as Record<string, unknown>;

  if (!entry) return null;

  const typeLabel = entry.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const dateStr = entry.timestamp
    ? new Date(entry.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : entry.date;
  const timeStr = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="entry-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="entry-modal"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: 'spring', bounce: 0.12, duration: 0.45 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/10 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1a1c30 0%, #0f1120 100%)',
            boxShadow: `0 30px 80px -15px rgba(0,0,0,0.6), 0 0 60px ${color}08`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent gradient */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

          {/* Header */}
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                {/* Icon circle */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                    color,
                    border: `1px solid ${color}30`,
                    boxShadow: `0 0 20px ${color}15`,
                  }}
                >
                  {icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white leading-tight truncate">{entry.label}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      {typeLabel}
                    </span>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${color}10`, color: `${color}90` }}
                    >
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/5 border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date/Time */}
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{dateStr}</span>
              {timeStr && (
                <>
                  <span className="text-slate-700">·</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeStr}</span>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px bg-white/[0.06]" />

          {/* Detail fields */}
          <div className="px-6 py-5 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {/* Macro ring for meals */}
            {entry.type === 'meal' && !!d.proteinGrams && !!d.carbsGrams && !!d.fatGrams && (
              <div className="pb-3 border-b border-white/[0.06]">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Macronutrients</p>
                <MacrosRing
                  protein={Number(d.proteinGrams)}
                  carbs={Number(d.carbsGrams)}
                  fat={Number(d.fatGrams)}
                />
              </div>
            )}

            {/* Progress bar for goals */}
            {(entry.type === 'health_goal' || entry.type === 'life_goal') && d.progress !== undefined && (
              <div className="pb-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Progress</p>
                  <span className="text-sm font-bold" style={{ color }}>{String(d.progress)}%</span>
                </div>
                <ProgressBar value={Number(d.progress)} max={100} color={color} />
              </div>
            )}

            {/* Recovery bar */}
            {entry.type === 'recovery_score' && d.recoveryScore != null && (
              <div className="pb-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Recovery</p>
                  <span className="text-sm font-bold" style={{ color }}>{String(d.recoveryScore)}%</span>
                </div>
                <ProgressBar value={Number(d.recoveryScore)} max={100} color={color} />
              </div>
            )}

            {/* Field grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {fields.map((field, i) => (
                <div
                  key={i}
                  className="rounded-xl px-3.5 py-3 border border-white/[0.06]"
                  style={{ background: field.highlight ? `${color}08` : 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {field.icon && <span className="text-slate-500">{field.icon}</span>}
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{field.label}</span>
                  </div>
                  <span
                    className="text-sm font-semibold block truncate"
                    style={{ color: field.highlight ? color : '#e2e8f0' }}
                  >
                    {field.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary / Explanation */}
            {summary && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1.5">Summary</p>
                <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
              </div>
            )}
          </div>

          {/* Source badge */}
          <div className="px-6 pb-5 pt-1">
            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <span>Source: {entry.sourceTable?.replace(/_/g, ' ') || entry.type.replace(/_/g, ' ')}</span>
              <span>·</span>
              <span>ID: {entry.id.slice(0, 8)}…</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
