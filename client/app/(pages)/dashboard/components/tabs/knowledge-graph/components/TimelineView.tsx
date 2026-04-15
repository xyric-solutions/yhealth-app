'use client';

import { useMemo } from 'react';
import {
  Dumbbell,
  Apple,
  Smile,
  Moon,
  Heart,
  Zap,
  Target,
  Brain,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Phone,
  Droplets,
  Gauge,
  Flame,
  CheckCircle2,
  Clock,
  Star,
  Wind,
  Flower2,
  Mic,
  ScanFace,
  Sunrise,
  BarChart3,
  HeartPulse,
  MessageCircle,
  CheckSquare,
  CalendarClock,
  Wallet,
  Trophy,
  Landmark,
  Package,
  type LucideIcon,
} from 'lucide-react';
import type { GraphNode, GraphNodeType, GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { NODE_CATEGORY_COLORS } from '@shared/types/domain/knowledge-graph';

interface TimelineViewProps {
  nodes: GraphNode[];
  onSelectNode: (node: GraphNode) => void;
  selectedNodeId: string | null;
}

const NODE_TYPE_ICONS: Partial<Record<GraphNodeType, LucideIcon>> = {
  workout_session: Dumbbell,
  exercise: Dumbbell,
  workout_plan: Target,
  yoga_session: Flower2,
  meal: Apple,
  diet_plan: Apple,
  water_intake: Droplets,
  mood_entry: Smile,
  stress_log: AlertTriangle,
  energy_log: Zap,
  journal_entry: BookOpen,
  habit_completion: CheckCircle2,
  mindfulness_practice: Brain,
  emotional_checkin: HeartPulse,
  daily_checkin: Clock,
  sleep_session: Moon,
  recovery_score: Heart,
  strain_score: Flame,
  health_goal: Target,
  life_goal: Star,
  goal_milestone: Star,
  goal_action: CheckSquare,
  daily_score: Gauge,
  insight: Brain,
  contradiction: AlertTriangle,
  correlation: TrendingUp,
  prediction: BarChart3,
  action_item: CheckSquare,
  weekly_report: BarChart3,
  voice_call: Phone,
  voice_journal: Mic,
  finance_insight: Landmark,
  finance_transaction: Wallet,
  breathing_test: Wind,
  meditation_session: Brain,
  emotion_detection: ScanFace,
  progress_record: TrendingUp,
  daily_intention: Sunrise,
  emotional_screening: HeartPulse,
  nutrition_pattern: Apple,
  chat_message: MessageCircle,
  activity_completion: CheckSquare,
  schedule_entry: CalendarClock,
  achievement: Trophy,
};

function getNodeIcon(type: GraphNodeType): LucideIcon {
  return NODE_TYPE_ICONS[type] ?? Package;
}

function getKeyMetrics(node: GraphNode): string[] {
  const d = node.data as Record<string, unknown>;
  switch (node.type) {
    case 'workout_session':
      return [
        d.durationMinutes ? `${d.durationMinutes} min` : '',
        d.status ? String(d.status) : '',
      ].filter(Boolean);
    case 'meal':
      return [
        d.mealType ? String(d.mealType) : '',
        d.calories ? `${d.calories} kcal` : '',
      ].filter(Boolean);
    case 'mood_entry':
      return [
        d.moodEmoji ? String(d.moodEmoji) : '',
        d.happinessRating ? `Happy: ${d.happinessRating}/10` : '',
      ].filter(Boolean);
    case 'sleep_session': {
      const hrs = d.sleepHours != null ? parseFloat(String(d.sleepHours)) : NaN;
      return [!isNaN(hrs) ? `${hrs.toFixed(1)}h` : ''].filter(Boolean);
    }
    case 'recovery_score':
      return [`${d.recoveryScore}% recovery`];
    case 'strain_score':
      return [`${d.strainScore} strain`];
    case 'water_intake':
      return [`${d.glassesConsumed}/${d.targetGlasses} glasses`];
    case 'daily_score':
      return [`Score: ${d.totalScore}/100`];
    case 'health_goal':
    case 'life_goal':
      return [
        d.progress !== undefined ? `${d.progress}%` : '',
        d.status ? String(d.status) : '',
      ].filter(Boolean);
    case 'journal_entry':
      return [
        d.wordCount ? `${d.wordCount} words` : '',
        d.sentimentLabel ? String(d.sentimentLabel) : '',
      ].filter(Boolean);
    default:
      return [];
  }
}

function normalizeDate(val: string | undefined | null): string {
  if (!val) return '';
  const match = String(val).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(val).slice(0, 10);
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );

  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (diff === 0) return `Today - ${formatted}`;
  if (diff === 1) return `Yesterday - ${formatted}`;
  return formatted;
}

export function TimelineView({
  nodes,
  onSelectNode,
  selectedNodeId,
}: TimelineViewProps) {
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, GraphNode[]>();
    for (const node of nodes) {
      const dateKey = normalizeDate(node.date) || 'unknown';
      const list = groups.get(dateKey) || [];
      list.push(node);
      groups.set(dateKey, list);
    }
    // Sort dates descending (most recent first)
    const sorted = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
    return sorted;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
        <Clock className="w-12 h-12 text-slate-600 mb-4" />
        <h3 className="text-base font-semibold text-slate-300 mb-1">
          No data for this period
        </h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Try expanding the date range or adjusting your category filters.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      {groupedByDate.map(([date, dateNodes]) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3 sticky top-0 bg-[#02000f]/80 backdrop-blur-sm z-10 py-1">
            <h3 className="text-sm font-bold text-white">
              {formatDateHeading(date)}
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-medium">
              {dateNodes.length}
            </span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Node cards */}
          <div className="space-y-2 ml-2">
            {dateNodes.map((node) => {
              const Icon = getNodeIcon(node.type);
              const color =
                NODE_CATEGORY_COLORS[node.category as GraphNodeCategory] ||
                '#94A3B8';
              const isSelected = selectedNodeId === node.id;
              const metrics = getKeyMetrics(node);

              return (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-sky-500/50 bg-sky-500/5'
                      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
                  }`}
                  style={{ borderLeftWidth: 4, borderLeftColor: color }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {node.label}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 capitalize"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {node.category}
                      </span>
                    </div>
                    {metrics.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {metrics.slice(0, 2).map((metric, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
