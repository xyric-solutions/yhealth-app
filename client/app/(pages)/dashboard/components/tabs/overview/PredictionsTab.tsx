'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Moon,
  Sun,
  Brain,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Activity,
  Target,
  BarChart3,
  Eye,
} from 'lucide-react';
import { intelligenceService } from '@/src/shared/services/intelligence.service';
import { HealthScoreHero } from './widgets/HealthScoreHero';
import { BestDayProgress } from './widgets/BestDayProgress';
import type {
  Prediction,
  ContradictionSummary,
  StoredContradiction,
  PredictionAccuracyStat,
} from '@shared/types/domain/intelligence';

// ─── Constants ───────────────────────────────────────────

const PREDICTION_ICONS: Record<string, typeof Zap> = {
  energy: Zap,
  mood: Sun,
  sleep: Moon,
  stress: Brain,
  recovery: Activity,
  focus: Target,
};

const PREDICTION_COLORS: Record<string, {
  gradient: string;
  accent: string;
  iconBg: string;
  ring: string;
  barColor: string;
}> = {
  energy: {
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    accent: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/20',
    ring: 'ring-amber-500/20',
    barColor: 'bg-gradient-to-r from-amber-500 to-orange-400',
  },
  mood: {
    gradient: 'from-yellow-500/20 via-amber-500/10 to-transparent',
    accent: 'text-yellow-400',
    iconBg: 'bg-yellow-500/15 border-yellow-500/20',
    ring: 'ring-yellow-500/20',
    barColor: 'bg-gradient-to-r from-yellow-500 to-amber-400',
  },
  sleep: {
    gradient: 'from-indigo-500/20 via-purple-500/10 to-transparent',
    accent: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15 border-indigo-500/20',
    ring: 'ring-indigo-500/20',
    barColor: 'bg-gradient-to-r from-indigo-500 to-purple-400',
  },
  stress: {
    gradient: 'from-rose-500/20 via-red-500/10 to-transparent',
    accent: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/20',
    ring: 'ring-rose-500/20',
    barColor: 'bg-gradient-to-r from-rose-500 to-red-400',
  },
  recovery: {
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    accent: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15 border-emerald-500/20',
    ring: 'ring-emerald-500/20',
    barColor: 'bg-gradient-to-r from-emerald-500 to-teal-400',
  },
  focus: {
    gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    accent: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15 border-cyan-500/20',
    ring: 'ring-cyan-500/20',
    barColor: 'bg-gradient-to-r from-cyan-500 to-blue-400',
  },
};

const DEFAULT_COLORS = {
  gradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
  accent: 'text-violet-400',
  iconBg: 'bg-violet-500/15 border-violet-500/20',
  ring: 'ring-violet-500/20',
  barColor: 'bg-gradient-to-r from-violet-500 to-purple-400',
};

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  high: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/25', label: 'High' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/25', label: 'Medium' },
  low: { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/25', label: 'Low' },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  critical: { bg: 'bg-red-500/[0.07]', text: 'text-red-400', border: 'border-red-500/15', iconBg: 'bg-red-500/15' },
  high: { bg: 'bg-orange-500/[0.07]', text: 'text-orange-400', border: 'border-orange-500/15', iconBg: 'bg-orange-500/15' },
  medium: { bg: 'bg-amber-500/[0.07]', text: 'text-amber-400', border: 'border-amber-500/15', iconBg: 'bg-amber-500/15' },
  low: { bg: 'bg-slate-500/[0.07]', text: 'text-slate-400', border: 'border-slate-500/15', iconBg: 'bg-slate-500/15' },
};

// ─── Section Wrapper ─────────────────────────────────────

function SectionHeader({ icon: Icon, iconColor, title, subtitle, trailing }: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center`}>
          <Icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${iconColor}`} />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {trailing}
    </div>
  );
}

// ─── Prediction Card (Premium) ───────────────────────────

function PredictionItem({ pred, idx }: { pred: Prediction; idx: number }) {
  const type = (pred.type || '').toLowerCase();
  const Icon = PREDICTION_ICONS[type] || Sparkles;
  const colors = PREDICTION_COLORS[type] || DEFAULT_COLORS;
  const conf = CONFIDENCE_STYLES[pred.confidence] || CONFIDENCE_STYLES.low;
  const unit = type === 'sleep' ? 'hrs' : '/ 10';
  const maxVal = type === 'sleep' ? 12 : 10;
  const pct = Math.min(100, (pred.predicted_value / maxVal) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm transition-all duration-500 hover:bg-white/[0.05] hover:border-white/[0.1] hover:shadow-xl hover:shadow-black/20`}>
        {/* Background gradient accent */}
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-500`} />

        {/* Mesh overlay for depth */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Icon */}
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${colors.iconBg} border flex items-center justify-center`}
            >
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.accent}`} />
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-white uppercase tracking-wider">{type}</span>
                  <span className={`text-[11px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full ring-1 ${conf.bg} ${conf.text} ${conf.ring} font-medium`}>
                    {conf.label}
                  </span>
                </div>
              </div>

              {/* Value */}
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums">{pred.predicted_value}</span>
                <span className="text-[11px] sm:text-xs text-slate-500 font-medium">{unit}</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${colors.barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, delay: 0.3 + idx * 0.07, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              {pred.reasoning && (
                <p className="mt-2.5 text-[11px] sm:text-[11px] text-slate-400/80 leading-relaxed line-clamp-2">{pred.reasoning}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Accuracy Stats (Redesigned) ─────────────────────────

function AccuracyPanel({ stats }: { stats: PredictionAccuracyStat | null }) {
  if (!stats) return null;

  const accuracy = stats.overallAccuracy ?? 0;
  const trend = accuracy >= 75 ? 'up' : accuracy >= 50 ? 'stable' : 'down';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400';
  const trendBg = trend === 'up' ? 'bg-emerald-500/10' : trend === 'down' ? 'bg-rose-500/10' : 'bg-slate-500/10';

  // Per-type accuracy breakdown
  const typeEntries = Object.entries(stats.byType || {}).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
    >
      <div className="p-4 sm:p-5">
        <SectionHeader
          icon={BarChart3}
          iconColor="text-cyan-400"
          title="Prediction Accuracy"
          subtitle="Model performance over 30 days"
        />

        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
          {/* Accuracy ring */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#predAccGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - accuracy / 100) }}
                transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
              <defs>
                <linearGradient id="predAccGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-bold text-white tabular-nums">{Math.round(accuracy)}%</span>
              <span className="text-[11px] text-slate-500 font-medium">accuracy</span>
            </div>
          </div>

          {/* Stats breakdown */}
          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${trendBg}`}>
                <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                <span className={`text-[11px] font-medium ${trendColor}`}>
                  {trend === 'up' ? 'Strong' : trend === 'down' ? 'Improving' : 'Stable'}
                </span>
              </div>
              {stats.totalTracked != null && (
                <span className="text-[11px] text-slate-500">{stats.totalTracked} tracked</span>
              )}
            </div>

            {/* Per-type bars */}
            {typeEntries.length > 0 && (
              <div className="space-y-2">
                {typeEntries.map(([type, data]) => {
                  const typeColors = PREDICTION_COLORS[type] || DEFAULT_COLORS;
                  return (
                    <div key={type} className="flex items-center gap-2.5">
                      <span className="text-[11px] text-slate-400 w-14 capitalize truncate">{type}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${typeColors.barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${data.accuracy}%` }}
                          transition={{ duration: 0.8, delay: 0.6 }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 w-8 text-right tabular-nums">{Math.round(data.accuracy)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Contradiction Card ──────────────────────────────────

function ContradictionCard({
  contradiction,
  onResolve,
  onDismiss,
  idx,
}: {
  contradiction: StoredContradiction;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  idx: number;
}) {
  const styles = SEVERITY_STYLES[contradiction.severity] || SEVERITY_STYLES.low;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.97 }}
      transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-xl border ${styles.border} ${styles.bg} p-3.5 sm:p-4 transition-colors duration-300 hover:bg-white/[0.03]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${styles.iconBg} flex items-center justify-center mt-0.5`}>
            <AlertTriangle className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${styles.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
              <span className={`text-[11px] sm:text-[11px] font-bold uppercase tracking-wider ${styles.text}`}>
                {contradiction.severity}
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">|</span>
              <span className="text-[11px] sm:text-[11px] text-slate-400 truncate">
                {contradiction.pillarA} vs {contradiction.pillarB}
              </span>
            </div>
            {contradiction.description && (
              <p className="text-[11px] sm:text-xs text-slate-300 mb-1 line-clamp-2 leading-relaxed">{contradiction.description}</p>
            )}
            {contradiction.aiCorrection && (
              <p className="text-[11px] sm:text-[11px] text-slate-400/80 italic leading-relaxed mt-1">{contradiction.aiCorrection}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onResolve(contradiction.id)}
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            title="Resolve"
          >
            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDismiss(contradiction.id)}
            className="p-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Contradictions Section ──────────────────────────────

function ContradictionsSection() {
  const [summary, setSummary] = useState<ContradictionSummary | null>(null);
  const [contradictions, setContradictions] = useState<StoredContradiction[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, listRes] = await Promise.all([
          intelligenceService.getContradictionSummary(),
          intelligenceService.getActiveContradictions(),
        ]);
        if (sumRes.data?.summary) setSummary(sumRes.data.summary);
        if (listRes.data?.contradictions) setContradictions(listRes.data.contradictions);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const total = summary ? summary.critical + summary.high + summary.medium + summary.low : 0;

  const handleResolve = async (id: string) => {
    await intelligenceService.resolveContradiction(id);
    setContradictions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDismiss = async (id: string) => {
    await intelligenceService.dismissContradiction(id);
    setContradictions((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm sm:text-base font-semibold text-white">Health Contradictions</h3>
            <p className="text-[11px] sm:text-[11px] text-slate-500 mt-0.5">
              {loading ? 'Analyzing pillars...' : total === 0 ? 'All health pillars aligned' : `${total} active contradiction${total !== 1 ? 's' : ''} detected`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Severity badges */}
          {!loading && total > 0 && (
            <div className="hidden sm:flex gap-1.5 mr-1">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const count = summary?.[sev] ?? 0;
                if (count === 0) return null;
                const s = SEVERITY_STYLES[sev];
                return (
                  <span key={sev} className={`text-[11px] px-2 py-0.5 rounded-full ${s.bg} ${s.text} border ${s.border} font-medium`}>
                    {count}
                  </span>
                );
              })}
            </div>
          )}
          {!loading && total > 0 && (
            <span className="sm:hidden text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15 font-medium">
              {total}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </motion.div>
        </div>
      </button>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2">
              {!loading && total === 0 && (
                <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[11px] sm:text-xs text-emerald-300/90">No contradictions detected — your health pillars are aligned!</span>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {contradictions.map((c, idx) => (
                  <ContradictionCard
                    key={c.id}
                    contradiction={c}
                    onResolve={handleResolve}
                    onDismiss={handleDismiss}
                    idx={idx}
                  />
                ))}
              </AnimatePresence>
              {loading && (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-white/[0.02] animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Predictions Tab ────────────────────────────────

export function PredictionsTab() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [accuracy, setAccuracy] = useState<PredictionAccuracyStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [reportRes, accRes] = await Promise.all([
        intelligenceService.getLatestReport(),
        intelligenceService.getPredictionAccuracy(30).catch(() => ({ data: null })),
      ]);
      if (reportRes.data?.report?.predictions) {
        setPredictions(reportRes.data.report.predictions);
      }
      if (accRes.data && 'stats' in accRes.data) {
        setAccuracy(accRes.data.stats);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ═══ Hero Section: Health Score + Best Day ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <SectionHeader
          icon={Eye}
          iconColor="text-indigo-400"
          title="Intelligence Overview"
          subtitle="Real-time health score and best day tracking"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <HealthScoreHero />
          </div>
          <BestDayProgress />
        </div>
      </motion.div>

      {/* ═══ Divider ═══ */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
      </div>

      {/* ═══ Predictions Section ═══ */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <Sparkles className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">AI Predictions</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Cross-domain intelligence forecasts</p>
            </div>
          </div>

          {!loading && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={fetchData}
              className="p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all duration-300"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            </motion.button>
          )}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-red-500/[0.04] border border-red-500/10 p-6 sm:p-8 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-slate-300 mb-3">Unable to load predictions</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchData}
              className="text-xs px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white transition-colors border border-white/[0.08]"
            >
              Try again
            </motion.button>
          </motion.div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 sm:h-32 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        )}

        {/* Predictions grid */}
        {!loading && !error && (
          <>
            {predictions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-8 sm:p-10 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-violet-400/50" />
                </div>
                <p className="text-sm text-slate-300 mb-1">No predictions available yet</p>
                <p className="text-xs text-slate-500">Check back after your first daily analysis report</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {predictions.map((pred, idx) => (
                  <PredictionItem key={`${pred.type}-${idx}`} pred={pred} idx={idx} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ Accuracy Panel ═══ */}
      {!loading && !error && <AccuracyPanel stats={accuracy} />}

      {/* ═══ Divider ═══ */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
      </div>

      {/* ═══ Contradictions Section ═══ */}
      <ContradictionsSection />
    </div>
  );
}
