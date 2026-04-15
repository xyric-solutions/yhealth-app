'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api-client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Brain,
  Heart,
  Activity,
  Moon,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Loader2,
  Zap,
  RefreshCw,
  AlertCircle,
  Sparkles,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  AnimatedNumber,
  ScoreBadge,
  ComparisonCard,
  InsightCard,
} from './scoring';
import { WhoopDataSection } from './scoring/WhoopDataSection';

interface RecoveryScore {
  scoreDate: string;
  recoveryScore: number;
  sleepScore?: number;
  stressScore?: number;
  moodScore?: number;
  emotionScore?: number;
  activityScore?: number;
  trend?: 'improving' | 'stable' | 'declining';
  factorsData?: Record<string, unknown>;
  components?: {
    sleep: number;
    stress: number;
    mood: number;
    emotion: number;
    activity: number;
  };
  emotionWeight?: number;
  emotionContribution?: number;
}

interface TrendData {
  date: string;
  score: number;
  sleepScore?: number;
  stressScore?: number;
  moodScore?: number;
  emotionScore?: number;
  activityScore?: number;
  trend?: 'improving' | 'stable' | 'declining';
}

interface ScoringData {
  currentScore: RecoveryScore;
  trends: TrendData[];
  componentScores: {
    sleep: number;
    stress: number;
    mood: number;
    emotion: number;
    activity: number;
  };
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    message: string;
    recommendation?: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
  comparison: {
    vsLastWeek: number;
    vsLastMonth: number;
    vsAverage: number;
    vsBest: number;
    vsWorst: number;
  };
  stats: {
    average: number;
    best: number;
    worst: number;
    improvementRate: number;
    consistency: number;
  };
}

// Brand colors - Emerald 600 as primary
const BRAND_COLORS = {
  primary: '#059669', // emerald-600
  secondary: '#00BCD4', // cyan/teal
  success: '#10b981', // emerald-500
  fitness: '#f97316', // orange-500
  nutrition: '#22c55e', // green-500
  wellbeing: '#3b82f6', // blue-500
  accent: '#8b5cf6', // violet-500
  pink: '#ec4899',
};

export function ScoringTab() {
  const [data, setData] = useState<ScoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '60d'>('30d');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());


  const fetchScoringData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const currentResponse = await api.get<RecoveryScore>('/recovery-score');
      const trendsResponse = await api.get<{ trends: TrendData[] }>('/recovery-score/trends', {
        params: { days: timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 60 },
      });

      if (currentResponse.success && currentResponse.data && trendsResponse.success && trendsResponse.data) {
        const current = currentResponse.data;
        const trends = trendsResponse.data.trends || [];

        const componentScores = {
          sleep: current.sleepScore ?? current.components?.sleep ?? 50,
          stress: current.stressScore ?? current.components?.stress ?? 50,
          mood: current.moodScore ?? current.components?.mood ?? 50,
          emotion: current.emotionScore ?? current.components?.emotion ?? 50,
          activity: current.activityScore ?? current.components?.activity ?? 50,
        };

        const today = new Date();
        const lastWeekDate = new Date(today);
        lastWeekDate.setDate(today.getDate() - 7);
        const lastMonthDate = new Date(today);
        lastMonthDate.setDate(today.getDate() - 30);

        const lastWeekScore =
          trends.find((t) => {
            const trendDate = new Date(t.date);
            const daysDiff = Math.abs((trendDate.getTime() - lastWeekDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff <= 2;
          })?.score ?? (trends.length > 0 ? trends[Math.max(0, trends.length - 7)]?.score : current.recoveryScore);

        const lastMonthScore =
          trends.find((t) => {
            const trendDate = new Date(t.date);
            const daysDiff = Math.abs((trendDate.getTime() - lastMonthDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff <= 5;
          })?.score ?? (trends.length > 0 ? trends[0]?.score : current.recoveryScore);

        const scores = trends.map((t) => t.score);
        const averageScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : current.recoveryScore;
        const bestScore = scores.length > 0 ? Math.max(...scores) : current.recoveryScore;
        const worstScore = scores.length > 0 ? Math.min(...scores) : current.recoveryScore;

        let improvementRate = 0;
        if (trends.length > 1) {
          const firstScore = trends[0].score;
          const lastScore = trends[trends.length - 1].score;
          improvementRate = ((lastScore - firstScore) / firstScore) * 100;
        }

        let consistency = 100;
        if (scores.length > 1) {
          const variance = scores.reduce((acc, score) => acc + Math.pow(score - averageScore, 2), 0) / scores.length;
          const stdDev = Math.sqrt(variance);
          consistency = Math.max(0, 100 - stdDev);
        }

        const insights: ScoringData['insights'] = [];

        if (current.recoveryScore >= 85) {
          insights.push({
            type: 'positive',
            message: 'Excellent recovery score! You are maintaining exceptional overall wellness.',
            recommendation: 'Keep up the excellent work! Maintain your current healthy habits and routines.',
            priority: 'low',
          });
        } else if (current.recoveryScore >= 70) {
          insights.push({
            type: 'positive',
            message: 'Great recovery score! You are doing well with your wellness journey.',
            recommendation: 'Continue maintaining your current habits. Small improvements in lower-scoring areas can push you even higher.',
            priority: 'low',
          });
        } else if (current.recoveryScore >= 60) {
          insights.push({
            type: 'info',
            message: 'Good recovery score. There is room for improvement to reach your peak performance.',
            recommendation: 'Focus on areas with lower scores. Small consistent changes can significantly boost your overall wellness.',
            priority: 'medium',
          });
        } else {
          insights.push({
            type: 'warning',
            message: 'Recovery score needs attention. Consider focusing on rest and recovery.',
            recommendation: 'Prioritize sleep, stress management, and take time for self-care. Consider consulting with a health professional.',
            priority: 'high',
          });
        }

        if (componentScores.sleep < 60) {
          insights.push({
            type: 'warning',
            message: 'Sleep duration or quality is below optimal. Quality sleep is crucial for recovery.',
            recommendation: 'Aim for 7-9 hours of sleep per night. Establish a consistent bedtime routine and limit screen time before bed.',
            priority: componentScores.sleep < 50 ? 'high' : 'medium',
          });
        } else if (componentScores.sleep >= 85) {
          insights.push({
            type: 'positive',
            message: 'Excellent sleep quality! Keep maintaining your healthy sleep routine.',
            priority: 'low',
          });
        }

        if (componentScores.stress < 60) {
          insights.push({
            type: 'warning',
            message: 'Stress levels are elevated. Consider stress management techniques.',
            recommendation: 'Try meditation, deep breathing exercises, yoga, or activities that help you relax. Consider talking to someone if stress persists.',
            priority: componentScores.stress < 50 ? 'high' : 'medium',
          });
        }

        if (componentScores.mood < 60) {
          insights.push({
            type: 'warning',
            message: 'Mood scores are lower than optimal. Your emotional wellbeing matters.',
            recommendation: 'Engage in activities you enjoy, spend time with loved ones, and consider speaking with a mental health professional if needed.',
            priority: componentScores.mood < 50 ? 'high' : 'medium',
          });
        }

        if (componentScores.activity < 60) {
          insights.push({
            type: 'info',
            message: 'Activity levels could be improved. Regular movement benefits both physical and mental health.',
            recommendation: 'Aim for at least 30 minutes of moderate activity daily. Start small and gradually increase your activity level.',
            priority: 'medium',
          });
        }

        if (improvementRate > 5) {
          insights.push({
            type: 'positive',
            message: `You are showing great improvement! Your recovery score has increased by ${improvementRate.toFixed(1)}% over this period.`,
            recommendation: 'Continue with your current approach. You are on the right track!',
            priority: 'low',
          });
        } else if (improvementRate < -5) {
          insights.push({
            type: 'warning',
            message: `Your recovery score has decreased by ${Math.abs(improvementRate).toFixed(1)}%. Consider reviewing what might be affecting your wellbeing.`,
            recommendation: 'Look at areas where scores have dropped and consider what changes in your routine might help.',
            priority: 'high',
          });
        }

        const scoringData: ScoringData = {
          currentScore: current,
          trends,
          componentScores,
          insights,
          comparison: {
            vsLastWeek: current.recoveryScore - lastWeekScore,
            vsLastMonth: current.recoveryScore - lastMonthScore,
            vsAverage: current.recoveryScore - averageScore,
            vsBest: current.recoveryScore - bestScore,
            vsWorst: current.recoveryScore - worstScore,
          },
          stats: {
            average: averageScore,
            best: bestScore,
            worst: worstScore,
            improvementRate,
            consistency,
          },
        };

        setData(scoringData);
        setLastUpdated(new Date());
      } else {
        setError('Failed to load scoring data');
      }
    } catch (err: unknown) {
      console.error('Failed to fetch scoring data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scoring data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchScoringData();
  }, [fetchScoringData]);


  const handleRefresh = () => {
    fetchScoringData(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 85) return 'from-emerald-500/30 via-green-500/30 to-emerald-600/30 border-emerald-500/40';
    if (score >= 70) return 'from-green-500/30 via-teal-500/30 to-green-600/30 border-green-500/40';
    if (score >= 60) return 'from-yellow-500/30 via-orange-500/30 to-yellow-600/30 border-yellow-500/40';
    if (score >= 50) return 'from-orange-500/30 via-red-500/30 to-orange-600/30 border-orange-500/40';
    return 'from-red-500/30 via-pink-500/30 to-red-600/30 border-red-500/40';
  };

  const getTrendIcon = (trend?: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-12 h-12 text-emerald-400" />;
      case 'declining':
        return <TrendingDown className="w-12 h-12 text-red-400" />;
      default:
        return <Target className="w-12 h-12 text-cyan-400" />;
    }
  };

  // Premium Skeleton Loading UI
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-slate-800/30 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-48 bg-slate-800/50 rounded-xl animate-pulse" />
            <div className="h-10 w-10 bg-slate-800/50 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Main Score Card Skeleton */}
        <div className="relative overflow-hidden rounded-3xl p-8 bg-slate-900/50 border border-white/10">
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-800/50 rounded animate-pulse" />
                <div className="flex items-baseline gap-3">
                  <div className="h-16 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
                  <div className="h-8 w-12 bg-slate-800/30 rounded animate-pulse" />
                </div>
                <div className="h-4 w-20 bg-slate-800/30 rounded animate-pulse" />
              </div>
              <div className="text-center lg:text-right">
                <div className="w-16 h-16 mx-auto lg:mx-0 lg:ml-auto bg-slate-800/50 rounded-full animate-pulse" />
                <div className="h-3 w-24 mt-2 mx-auto lg:mx-0 lg:ml-auto bg-slate-800/30 rounded animate-pulse" />
              </div>
            </div>

            {/* Comparison Cards Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-800/30 rounded-xl animate-pulse" />
              ))}
            </div>

            {/* Stats Row Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 bg-slate-800/30 rounded animate-pulse" />
                  <div className="h-6 w-12 bg-slate-800/50 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Component Scores Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-900/50 rounded-2xl border border-white/10 animate-pulse" />
          ))}
        </div>

        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-900/50 rounded-2xl border border-white/10 p-6 animate-pulse">
            <div className="h-6 w-32 bg-slate-800/50 rounded mb-4" />
            <div className="h-64 bg-slate-800/30 rounded-xl" />
          </div>
          <div className="h-80 bg-slate-900/50 rounded-2xl border border-white/10 p-6 animate-pulse">
            <div className="h-6 w-32 bg-slate-800/50 rounded mb-4" />
            <div className="h-64 bg-slate-800/30 rounded-xl" />
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-10 h-10 text-emerald-500" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse' }}
            className="text-slate-400 text-sm"
          >
            Calculating your recovery score...
          </motion.p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-96 gap-4"
      >
        <div className="p-4 rounded-full bg-red-500/20">
          <AlertCircle className="w-12 h-12 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-red-400 mb-2 font-semibold">{error}</p>
          <p className="text-slate-400 text-sm mb-4">Please try refreshing the data</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-medium transition-all flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/30"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return null;
  }

  const chartData = data.trends.map((trend) => ({
    date: new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: trend.date,
    score: trend.score,
    sleep: trend.sleepScore ?? data.componentScores.sleep,
    stress: trend.stressScore ?? data.componentScores.stress,
    mood: trend.moodScore ?? data.componentScores.mood,
    emotion: trend.emotionScore ?? data.componentScores.emotion,
    activity: trend.activityScore ?? data.componentScores.activity,
  }));

  const radarData = [
    { subject: 'Sleep', score: data.componentScores.sleep, fullMark: 100 },
    { subject: 'Stress', score: data.componentScores.stress, fullMark: 100 },
    { subject: 'Mood', score: data.componentScores.mood, fullMark: 100 },
    { subject: 'Emotion', score: data.componentScores.emotion, fullMark: 100 },
    { subject: 'Activity', score: data.componentScores.activity, fullMark: 100 },
  ];

  const componentData = [
    { name: 'Sleep', value: data.componentScores.sleep, color: BRAND_COLORS.wellbeing },
    { name: 'Stress', value: data.componentScores.stress, color: BRAND_COLORS.fitness },
    { name: 'Mood', value: data.componentScores.mood, color: BRAND_COLORS.pink },
    { name: 'Emotion', value: data.componentScores.emotion, color: BRAND_COLORS.accent },
    { name: 'Activity', value: data.componentScores.activity, color: BRAND_COLORS.primary },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-[16px] sm:text-[18px] font-bold text-white mb-2 flex items-center gap-2 sm:gap-3">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            Recovery & Wellness Scoring
          </h2>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Last updated: {lastUpdated.toLocaleTimeString()}
            {isRefreshing && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-800/50 backdrop-blur-xl rounded-xl p-1 border border-white/10">
            {(['7d', '30d', '60d'] as const).map((range) => (
              <motion.button
                key={range}
                onClick={() => setTimeRange(range)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '60 Days'}
              </motion.button>
            ))}
          </div>
          <motion.button
            onClick={handleRefresh}
            disabled={isRefreshing}
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-emerald-600/20 hover:border-emerald-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </motion.div>

      {/* WHOOP Data Section - Pass timeRange */}
      <WhoopDataSection timeRange={timeRange} />

      {/* Main Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className={`relative bg-gradient-to-br ${getScoreGradient(data.currentScore.recoveryScore)} rounded-3xl p-8 border-2 overflow-hidden`}
      >
        {/* Animated background pattern */}
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
            <div>
              <p className="text-slate-300 text-sm mb-2 font-medium">Overall Recovery Score</p>
              <div className="flex items-baseline gap-3">
                <motion.p
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className={`text-3xl sm:text-4xl font-bold ${getScoreColor(data.currentScore.recoveryScore)}`}
                >
                  <AnimatedNumber value={data.currentScore.recoveryScore} />
                </motion.p>
                <span className="text-base sm:text-lg text-slate-400 font-medium">/100</span>
              </div>
              <p className="text-slate-400 text-sm mt-2">
                {data.currentScore.recoveryScore >= 85
                  ? 'Excellent'
                  : data.currentScore.recoveryScore >= 70
                    ? 'Great'
                    : data.currentScore.recoveryScore >= 60
                      ? 'Good'
                      : data.currentScore.recoveryScore >= 50
                        ? 'Fair'
                        : 'Needs Attention'}
              </p>
            </div>
            <div className="text-center lg:text-right">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {getTrendIcon(data.currentScore.trend)}
              </motion.div>
              <p className="text-slate-300 text-sm mt-2 capitalize font-medium">
                {data.currentScore.trend || 'Stable'} Trend
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ComparisonCard label="vs Last Week" value={data.comparison.vsLastWeek} delay={0.1} />
            <ComparisonCard label="vs Last Month" value={data.comparison.vsLastMonth} delay={0.2} />
            <ComparisonCard label="vs Average" value={data.comparison.vsAverage} delay={0.3} />
            <ComparisonCard label="vs Best" value={data.comparison.vsBest} delay={0.4} />
            <ComparisonCard label="vs Worst" value={data.comparison.vsWorst} delay={0.5} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-xs text-slate-400 mb-1">Average</p>
              <p className="text-xl font-bold text-white">{data.stats.average.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Best</p>
              <p className="text-xl font-bold text-emerald-400">{data.stats.best.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Worst</p>
              <p className="text-xl font-bold text-red-400">{data.stats.worst.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Consistency</p>
              <p className="text-xl font-bold text-cyan-400">{data.stats.consistency.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Component Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ScoreBadge score={data.componentScores.sleep} label="Sleep" icon={Moon} color="blue" />
        <ScoreBadge score={data.componentScores.stress} label="Stress" icon={Zap} color="orange" />
        <ScoreBadge score={data.componentScores.mood} label="Mood" icon={Heart} color="pink" />
        <ScoreBadge score={data.componentScores.emotion} label="Emotion" icon={Brain} color="purple" />
        <ScoreBadge score={data.componentScores.activity} label="Activity" icon={Activity} color="green" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Trends Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -2 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-emerald-500/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              Score Trends
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND_COLORS.primary} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={BRAND_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={{ stroke: '#4b5563' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                  }}
                  labelStyle={{ color: '#fff', marginBottom: '8px', fontWeight: 600 }}
                  formatter={(value: number | string | undefined) => {
                    if (value === undefined) return ['N/A', 'Score'];
                    return [`${Math.round(Number(value))}`, 'Score'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={BRAND_COLORS.primary}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorScoreGradient)"
                  name="Recovery Score"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No trend data available</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Component Analysis Radar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -2 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-cyan-500/30 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Target className="w-5 h-5 text-cyan-400" />
            </div>
            Component Analysis
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" opacity={0.3} />
              <PolarAngleAxis dataKey="subject" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke={BRAND_COLORS.primary}
                fill={BRAND_COLORS.primary}
                fillOpacity={0.6}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  padding: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: '#fff' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Component Comparison Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        whileHover={{ y: -2 }}
        className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-green-500/30 transition-colors"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-green-500/10">
            <BarChart3 className="w-5 h-5 text-green-400" />
          </div>
          Component Comparison
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={componentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1500}>
              {componentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Insights & Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
      >
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          Insights & Recommendations
        </h3>
        <div className="space-y-4">
          <AnimatePresence>
            {data.insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} index={index} />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Data Freshness Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center gap-2 text-xs text-slate-500"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Live data • Auto-refreshes every 5 minutes</span>
      </motion.div>
    </div>
  );
}
