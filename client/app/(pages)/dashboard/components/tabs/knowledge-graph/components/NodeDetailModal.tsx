'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EntryDetailModal } from './EntryDetailModal';
import {
  X, ChevronLeft, ChevronRight, Dumbbell, Utensils, Smile, Moon,
  Heart, Zap, Target, Brain, BookOpen, AlertTriangle, TrendingUp,
  Phone, Droplets, Gauge, Flame, CheckCircle2, Clock, Star,
  Wind, Flower2, Mic, ScanFace, Sunrise, BarChart3, HeartPulse,
  MessageCircle, CheckSquare, CalendarClock, Wallet, Trophy, Landmark,
} from 'lucide-react';
import type { GraphNode, GraphNodeType, GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../constants/graph-config';

interface NodeAttrs {
  label: string;
  category: GraphNodeCategory;
  nodeKind: string;
  entryCount: number;
  entries: GraphNode[];
  date?: string;
}

interface NodeDetailModalProps {
  nodeAttrs: NodeAttrs | null;
  nodeId: string | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  totalNodes: number;
}

const TYPE_ICONS: Partial<Record<GraphNodeType, React.ReactNode>> = {
  workout_session: <Dumbbell className="w-4 h-4" />,
  meal: <Utensils className="w-4 h-4" />,
  mood_entry: <Smile className="w-4 h-4" />,
  sleep_session: <Moon className="w-4 h-4" />,
  recovery_score: <Heart className="w-4 h-4" />,
  strain_score: <Flame className="w-4 h-4" />,
  energy_log: <Zap className="w-4 h-4" />,
  stress_log: <AlertTriangle className="w-4 h-4" />,
  health_goal: <Target className="w-4 h-4" />,
  life_goal: <Star className="w-4 h-4" />,
  daily_score: <Gauge className="w-4 h-4" />,
  journal_entry: <BookOpen className="w-4 h-4" />,
  contradiction: <AlertTriangle className="w-4 h-4" />,
  correlation: <TrendingUp className="w-4 h-4" />,
  habit_completion: <CheckCircle2 className="w-4 h-4" />,
  voice_call: <Phone className="w-4 h-4" />,
  water_intake: <Droplets className="w-4 h-4" />,
  insight: <Brain className="w-4 h-4" />,
  daily_checkin: <Clock className="w-4 h-4" />,
  breathing_test: <Wind className="w-4 h-4" />,
  yoga_session: <Flower2 className="w-4 h-4" />,
  meditation_session: <Brain className="w-4 h-4" />,
  voice_journal: <Mic className="w-4 h-4" />,
  emotion_detection: <ScanFace className="w-4 h-4" />,
  progress_record: <TrendingUp className="w-4 h-4" />,
  daily_intention: <Sunrise className="w-4 h-4" />,
  weekly_report: <BarChart3 className="w-4 h-4" />,
  emotional_screening: <HeartPulse className="w-4 h-4" />,
  nutrition_pattern: <Utensils className="w-4 h-4" />,
  chat_message: <MessageCircle className="w-4 h-4" />,
  activity_completion: <CheckSquare className="w-4 h-4" />,
  schedule_entry: <CalendarClock className="w-4 h-4" />,
  finance_transaction: <Wallet className="w-4 h-4" />,
  achievement: <Trophy className="w-4 h-4" />,
  finance_insight: <Landmark className="w-4 h-4" />,
};

function EntryCard({ entry, onClick }: { entry: GraphNode; onClick?: () => void }) {
  const d = entry.data as Record<string, unknown>;
  const icon = TYPE_ICONS[entry.type] || <Brain className="w-4 h-4" />;

  const details = useMemo(() => {
    switch (entry.type) {
      case 'workout_session':
        return [
          d.durationMinutes && `${d.durationMinutes} min`,
          d.status && String(d.status),
          d.xpEarned && `+${d.xpEarned} XP`,
        ].filter(Boolean);
      case 'meal':
        return [
          d.mealType && String(d.mealType),
          d.calories && `${d.calories} kcal`,
          d.proteinGrams && `P: ${d.proteinGrams}g`,
          d.carbsGrams && `C: ${d.carbsGrams}g`,
          d.fatGrams && `F: ${d.fatGrams}g`,
        ].filter(Boolean);
      case 'mood_entry':
        return [
          d.moodEmoji && String(d.moodEmoji),
          d.happinessRating && `Happy: ${d.happinessRating}/10`,
          d.stressRating && `Stress: ${d.stressRating}/10`,
        ].filter(Boolean);
      case 'sleep_session': {
        const hrs = d.sleepHours != null ? parseFloat(String(d.sleepHours)) : NaN;
        return [
          !isNaN(hrs) ? `${hrs.toFixed(1)}h` : null,
          d.provider && String(d.provider),
        ].filter(Boolean);
      }
      case 'recovery_score':
        return [`${d.recoveryScore}% recovery`];
      case 'strain_score':
        return [`${d.strainScore} strain`];
      case 'stress_log':
        return [`${d.stressRating}/10`, d.finalStressScore && `Score: ${d.finalStressScore}`].filter(Boolean);
      case 'energy_log':
        return [`${d.energyRating}/10 energy`, d.contextTag && String(d.contextTag)].filter(Boolean);
      case 'water_intake':
        return [`${d.glassesConsumed}/${d.targetGlasses} glasses`, d.goalAchieved ? 'Goal met' : 'In progress'];
      case 'daily_score':
        return [`Score: ${d.totalScore}/100`];
      case 'health_goal':
      case 'life_goal':
        return [d.category && String(d.category), d.progress !== undefined && `${d.progress}%`].filter(Boolean);
      case 'habit_completion':
        return [d.habitName && String(d.habitName), d.completed ? 'Done' : 'Missed'].filter(Boolean);
      case 'journal_entry':
        return [
          d.promptCategory && String(d.promptCategory),
          d.wordCount && `${d.wordCount} words`,
          d.sentimentLabel && String(d.sentimentLabel),
        ].filter(Boolean);
      case 'daily_checkin':
        return [
          d.moodScore && `Mood: ${d.moodScore}`,
          d.energyScore && `Energy: ${d.energyScore}`,
          d.stressScore && `Stress: ${d.stressScore}`,
        ].filter(Boolean);
      case 'breathing_test':
        return [
          d.testType && `Type: ${d.testType}`,
          d.totalDurationSeconds && `Duration: ${d.totalDurationSeconds}s`,
          d.consistencyScore != null && `Consistency: ${d.consistencyScore}%`,
        ].filter(Boolean);
      case 'meditation_session':
        return [
          d.mode && `Mode: ${d.mode}`,
          d.durationMinutes && `Duration: ${d.durationMinutes}min`,
          d.completed != null && `Completed: ${d.completed}`,
        ].filter(Boolean);
      case 'emotion_detection':
        return [
          d.emotionCategory && `Emotion: ${d.emotionCategory}`,
          d.confidenceScore != null && `Confidence: ${d.confidenceScore}%`,
          d.source && `Source: ${d.source}`,
        ].filter(Boolean);
      case 'progress_record':
        return [
          d.recordType && `Type: ${d.recordType}`,
          d.recordDate && `Date: ${d.recordDate}`,
        ].filter(Boolean);
      case 'daily_intention':
        return [
          d.intentionText && `Intention: ${d.intentionText}`,
          d.fulfilled != null && `Fulfilled: ${d.fulfilled}`,
        ].filter(Boolean);
      case 'emotional_screening':
        return [
          d.screeningType && `Type: ${d.screeningType}`,
          d.overallAnxietyScore != null && `Anxiety: ${d.overallAnxietyScore}`,
          d.overallMoodScore != null && `Mood: ${d.overallMoodScore}`,
          d.riskLevel && `Risk: ${d.riskLevel}`,
        ].filter(Boolean);
      case 'nutrition_pattern':
        return [
          d.patternKey && `Pattern: ${d.patternKey}`,
          d.successRate != null && `Success: ${d.successRate}%`,
          d.confidenceScore != null && `Confidence: ${d.confidenceScore}`,
        ].filter(Boolean);
      case 'chat_message':
        return [
          d.role && `Role: ${d.role}`,
          d.contentPreview && `Preview: ${d.contentPreview}`,
        ].filter(Boolean);
      case 'activity_completion':
        return [
          d.activityId && `Activity: ${d.activityId}`,
          d.status && `Status: ${d.status}`,
        ].filter(Boolean);
      case 'schedule_entry':
        return [
          d.scheduleDate && `Date: ${d.scheduleDate}`,
          d.itemCount != null && `Items: ${d.itemCount}`,
        ].filter(Boolean);
      case 'finance_transaction':
        return [
          d.title && `Title: ${d.title}`,
          d.amount != null && `Amount: ${d.amount}`,
          d.transactionType && `Type: ${d.transactionType}`,
        ].filter(Boolean);
      case 'achievement':
        return [
          d.achievementName && `Achievement: ${d.achievementName}`,
          d.progress != null && `Progress: ${d.progress}%`,
        ].filter(Boolean);
      default:
        return Object.entries(d)
          .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
          .slice(0, 3)
          .map(([, v]) => String(v));
    }
  }, [entry, d]);

  return (
    <div
      className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white truncate">{entry.label}</span>
          <span className="text-[10px] text-slate-600 shrink-0">{entry.date}</span>
        </div>
        {details.length > 0 && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(details as string[]).map((detail, i) => (
              <span
                key={i}
                className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400"
              >
                {detail}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NodeDetailModal({
  nodeAttrs,
  nodeId,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalNodes,
}: NodeDetailModalProps) {
  // Entry detail drill-down
  const [selectedEntry, setSelectedEntry] = useState<GraphNode | null>(null);

  // All hooks must be called before any conditional return
  const entries = nodeAttrs?.entries || [];
  const groupedByType = useMemo(() => {
    const groups = new Map<string, GraphNode[]>();
    for (const entry of entries) {
      const key = entry.type;
      const list = groups.get(key) || [];
      list.push(entry);
      groups.set(key, list);
    }
    return groups;
  }, [entries]);

  const color = nodeAttrs ? (CATEGORY_COLORS[nodeAttrs.category] || '#94A3B8') : '#94A3B8';

  if (!nodeAttrs || !nodeId) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #181a2e 0%, #10121e 100%)',
            boxShadow: `0 25px 60px -10px rgba(0,0,0,0.5), 0 0 40px ${color}10`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Colored top bar */}
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

          {/* Header */}
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              {/* Prev / Next */}
              <div className="flex items-center gap-1">
                <button
                  onClick={onPrev}
                  disabled={totalNodes <= 1}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-25"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-500 tabular-nums w-12 text-center">
                  {currentIndex + 1} / {totalNodes}
                </span>
                <button
                  onClick={onNext}
                  disabled={totalNodes <= 1}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-25"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Identity */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{
                  backgroundColor: `${color}20`,
                  color,
                  boxShadow: `0 0 30px ${color}15`,
                }}
              >
                {nodeAttrs.entryCount}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{nodeAttrs.label}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {CATEGORY_LABELS[nodeAttrs.category]}
                  </span>
                  {nodeAttrs.date && (
                    <span className="text-[11px] text-slate-500">{nodeAttrs.date}</span>
                  )}
                  <span className="text-[11px] text-slate-600">
                    {nodeAttrs.entryCount} {nodeAttrs.entryCount === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Entries list */}
          <div className="px-6 pb-6 max-h-[55vh] overflow-y-auto scrollbar-hide">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No entries to display</p>
            ) : groupedByType.size <= 1 ? (
              // Single type: flat list
              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <EntryCard key={entry.id || i} entry={entry} onClick={() => setSelectedEntry(entry)} />
                ))}
              </div>
            ) : (
              // Multiple types: grouped
              <div className="space-y-4">
                {[...groupedByType.entries()].map(([type, typeEntries]) => (
                  <div key={type}>
                    <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1">
                      {type.replace(/_/g, ' ')} ({typeEntries.length})
                    </h4>
                    <div className="space-y-1.5">
                      {typeEntries.map((entry, i) => (
                        <EntryCard key={entry.id || i} entry={entry} onClick={() => setSelectedEntry(entry)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Entry Detail Drill-Down */}
      {selectedEntry && (
        <EntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </AnimatePresence>
  );
}
