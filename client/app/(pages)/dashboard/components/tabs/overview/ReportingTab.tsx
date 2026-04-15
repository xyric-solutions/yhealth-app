'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import { api } from '@/lib/api-client';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,

  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  AlertCircle,

  Clock,
  Loader2,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Zap,
  Activity,
  UtensilsCrossed,
  Moon,
  Brain,
  Heart,
  ChevronDown,
  Info,
  AlertTriangle,
  CheckCircle2,
  Phone,
} from 'lucide-react';

// ============================================
// TYPES - Matching Backend ComprehensiveReport
// ============================================

interface ReportSummary {
    period: string;
    totalActivities: number;
    completedActivities: number;
    completionRate: number;
    averageScore: number;
    improvementAreas: string[];
    achievements: string[];
  totalWorkouts: number;
  totalMeals: number;
  totalSleepHours: number;
  averageMood: number;
  mentalRecoveryScore: number;
}

interface WeeklyReport {
    week: string;
    completed: number;
    total: number;
    score: number;
  workouts: number;
  meals: number;
}

interface CategoryPerformance {
    category: string;
    completed: number;
    total: number;
    averageScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface GoalProgress {
    goal: string;
    progress: number;
    target: number;
    status: 'on-track' | 'behind' | 'ahead';
  percentage: number;
}

interface Recommendation {
    priority: 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    action: string;
  impact?: string;
}

interface HealthTrend {
    metric: string;
    current: number;
    previous: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  unit: string;
}

interface ComprehensiveReport {
  summary: ReportSummary;
  weeklyReport: WeeklyReport[];
  categoryPerformance: CategoryPerformance[];
  goalProgress: GoalProgress[];
  recommendations: Recommendation[];
  healthTrends: HealthTrend[];
  emotionAnalysis?: {
    dominantEmotions: Array<{ emotion: string; count: number; percentage: number }>;
    emotionTrend: 'improving' | 'stable' | 'declining';
  };
  callHistory?: {
    totalCalls: number;
    averageDuration: number;
    purposes: Record<string, number>;
  };
}

// ============================================
// ANIMATED COMPONENTS
// ============================================

// Animated number component
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const spring = useSpring(0, { stiffness: 50, damping: 30 });
  const [displayText, setDisplayText] = useState<string>('0');

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (decimals === 0) {
        setDisplayText(Math.round(latest).toString());
      } else {
        setDisplayText(latest.toFixed(decimals));
      }
    });
    return () => unsubscribe();
  }, [spring, decimals]);

  return <motion.span>{displayText}</motion.span>;
}

// Animated progress bar
function AnimatedProgressBar({
  value,
  color,
  delay = 0,
  height = 'h-2',
}: {
  value: number;
  color: string;
  delay?: number;
  height?: string;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={`relative ${height} bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedValue}%` }}
        transition={{
          duration: 1.5,
          delay,
          ease: [0.4, 0, 0.2, 1],
        }}
        className={`h-full rounded-full ${color} relative`}
      >
        <motion.div
          className="absolute inset-0 bg-white/20"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>
    </div>
  );
}

// Animated Stat Card Component
function AnimatedStatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  delay = 0,
  trend,
  trendValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  subtitle?: string;
  color: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'pink';
  delay?: number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}) {
  const colorClasses = {
    purple: {
      icon: 'text-purple-400',
      bg: 'from-purple-500/20 to-purple-600/20',
      border: 'border-purple-500/30',
      progress: 'from-purple-500 to-purple-600',
    },
    blue: {
      icon: 'text-blue-400',
      bg: 'from-blue-500/20 to-blue-600/20',
      border: 'border-blue-500/30',
      progress: 'from-blue-500 to-blue-600',
    },
    green: {
      icon: 'text-green-400',
      bg: 'from-green-500/20 to-green-600/20',
      border: 'border-green-500/30',
      progress: 'from-green-500 to-green-600',
    },
    orange: {
      icon: 'text-orange-400',
      bg: 'from-orange-500/20 to-orange-600/20',
      border: 'border-orange-500/30',
      progress: 'from-orange-500 to-orange-600',
    },
    red: {
      icon: 'text-red-400',
      bg: 'from-red-500/20 to-red-600/20',
      border: 'border-red-500/30',
      progress: 'from-red-500 to-red-600',
    },
    pink: {
      icon: 'text-pink-400',
      bg: 'from-pink-500/20 to-pink-600/20',
      border: 'border-pink-500/30',
      progress: 'from-pink-500 to-pink-600',
    },
  };

  const classes = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.05, y: -4 }}
      className={`relative bg-gradient-to-br ${classes.bg} backdrop-blur-xl rounded-2xl p-6 border-2 ${classes.border} overflow-hidden group`}
    >
      {/* Animated background glow */}
      <motion.div
        className={`absolute -inset-1 bg-gradient-to-r ${classes.progress} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={`p-3 rounded-xl bg-white/5 ${classes.icon}`}
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-400">{label}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-lg font-bold text-white">
                  {typeof value === 'number' ? <AnimatedNumber value={value} decimals={value % 1 !== 0 ? 1 : 0} /> : value}
                </p>
                {trend && trendValue !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.2 }}
                    className={`flex items-center gap-1 text-xs font-medium ${
                      trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
                    }`}
                  >
                    {trend === 'up' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : trend === 'down' ? (
                      <ArrowDownRight className="w-3 h-3" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    {Math.abs(trendValue).toFixed(1)}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

// Category Progress Bar Component
function CategoryProgressBar({
  category,
  completed,
  total,
  averageScore,
  trend,
  index,
}: CategoryPerformance & { index: number }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    workout: Activity,
    meal: UtensilsCrossed,
    sleep_routine: Moon,
    mindfulness: Brain,
    habit: Zap,
    check_in: Clock,
    reflection: FileText,
    learning: Brain,
    other: Target,
  };

  const Icon = categoryIcons[category] || Target;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ x: 4 }}
      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Icon className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-white capitalize">{category.replace('_', ' ')}</p>
            <p className="text-xs text-slate-400">
              {completed} / {total} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : trend === 'down' ? (
            <TrendingDown className="w-4 h-4 text-red-400" />
          ) : (
            <Minus className="w-4 h-4 text-slate-400" />
          )}
          <p className="text-sm font-semibold text-purple-400">{averageScore.toFixed(1)}%</p>
        </div>
      </div>
      <AnimatedProgressBar value={percentage} color="bg-gradient-to-r from-purple-500 to-purple-600" delay={index * 0.1} />
    </motion.div>
  );
}

// Goal Progress Card Component
function GoalProgressCard({ goal, progress, target, status, percentage, index }: GoalProgress & { index: number }) {
  const progressPercentage = Math.min(100, (progress / target) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2 }}
      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-white">{goal}</p>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            status === 'on-track'
              ? 'bg-green-500/20 text-green-400'
              : status === 'ahead'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {status === 'on-track' ? 'On Track' : status === 'ahead' ? 'Ahead' : 'Behind'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <AnimatedProgressBar
            value={progressPercentage}
            color={
              status === 'on-track'
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : status === 'ahead'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                : 'bg-gradient-to-r from-red-500 to-red-600'
            }
            delay={index * 0.1}
          />
        </div>
        <p className="text-sm font-semibold text-slate-300 min-w-[80px] text-right">
          {progress.toFixed(1)} / {target.toFixed(1)}
        </p>
      </div>
      <p className="text-xs text-slate-500 mt-2">{percentage}% complete</p>
    </motion.div>
  );
}

// Recommendation Card Component
function RecommendationCard({ recommendation, index }: { recommendation: Recommendation; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const iconMap = {
    high: AlertTriangle,
    medium: Info,
    low: CheckCircle2,
  };

  const Icon = iconMap[recommendation.priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2 }}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        recommendation.priority === 'high'
          ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
          : recommendation.priority === 'medium'
          ? 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50'
          : 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50'
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          <div
            className={`p-2 rounded-lg ${
              recommendation.priority === 'high'
                ? 'bg-red-500/20'
                : recommendation.priority === 'medium'
                ? 'bg-orange-500/20'
                : 'bg-blue-500/20'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                recommendation.priority === 'high' ? 'text-red-400' : recommendation.priority === 'medium' ? 'text-orange-400' : 'text-blue-400'
              }`}
            />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{recommendation.category}</p>
            <p className="text-sm text-slate-300 mt-1">{recommendation.recommendation}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              recommendation.priority === 'high'
                ? 'bg-red-500/20 text-red-400'
                : recommendation.priority === 'medium'
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {recommendation.priority.toUpperCase()}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2 border-t border-white/10 mt-3">
              <p className="text-sm text-slate-400">
                <strong className="text-white">Action:</strong> {recommendation.action}
              </p>
              {recommendation.impact && (
                <p className="text-sm text-slate-400">
                  <strong className="text-white">Impact:</strong> {recommendation.impact}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Trend Card Component
function TrendCard({ trend, index }: { trend: HealthTrend; index: number }) {
  const isPositive = trend.change >= 0;
  const isNeutral = trend.change === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.05, y: -2 }}
      className={`relative bg-gradient-to-br ${
        isPositive
          ? 'from-green-500/10 to-emerald-500/10 border-green-500/20'
          : isNeutral
          ? 'from-slate-500/10 to-slate-600/10 border-slate-500/20'
          : 'from-red-500/10 to-pink-500/10 border-red-500/20'
      } backdrop-blur-xl rounded-xl p-4 border-2 overflow-hidden group`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-white">{trend.metric}</p>
        {trend.trend === 'up' ? (
          <TrendingUp className="w-5 h-5 text-green-400" />
        ) : trend.trend === 'down' ? (
          <TrendingDown className="w-5 h-5 text-red-400" />
        ) : (
          <Clock className="w-5 h-5 text-blue-400" />
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <p className="text-lg font-bold text-white">
          {trend.current.toFixed(trend.unit.includes('/') ? 1 : 0)}
          <span className="text-sm font-normal text-slate-400 ml-1">{trend.unit}</span>
        </p>
        <p className={`text-sm font-medium ${isPositive ? 'text-green-400' : isNeutral ? 'text-slate-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}
          {trend.change.toFixed(1)} from previous
        </p>
      </div>
    </motion.div>
  );
}

// Export Button Component
function ExportButton({
  format,
  onClick,
  isGenerating,
}: {
  format: 'pdf' | 'csv' | 'json';
  onClick: () => void;
  isGenerating: boolean;
}) {
  const colors = {
    pdf: 'bg-red-600 hover:bg-red-700',
    csv: 'bg-green-600 hover:bg-green-700',
    json: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={isGenerating}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`flex items-center gap-2 px-4 py-2 ${colors[format]} rounded-lg text-white disabled:opacity-50 transition-all`}
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Export {format.toUpperCase()}
    </motion.button>
  );
}

// Skeleton Loader
function SkeletonCard() {
  return (
    <div className="bg-slate-900/50 rounded-xl p-6 border border-white/10 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-1/4 mb-4"></div>
      <div className="h-8 bg-slate-700 rounded w-1/2 mb-2"></div>
      <div className="h-2 bg-slate-700 rounded w-full"></div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReportingTab() {
  const [data, setData] = useState<ComprehensiveReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReportData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
      setIsLoading(true);
      }
      setError(null);

      const response = await api.get<ComprehensiveReport>('/reports/generate', {
        params: { period: reportPeriod },
      });

      if (response.success && response.data) {
        setData(response.data);
        setLastUpdated(new Date());
        if (isRefresh) {
          toast.success('Report refreshed successfully');
        }
      } else {
        setError('Failed to load report data');
        toast.error('Failed to load report data');
      }
    } catch (err: unknown) {
      console.error('Failed to fetch report:', err);
      const errorMessage = (err instanceof Error ? err.message : null) || 'Failed to load report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [reportPeriod]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    setIsGenerating(true);
    try {
      if (format === 'json' && data) {
        const reportWithMetadata = {
          ...data,
          metadata: {
            generatedAt: new Date().toISOString(),
            period: reportPeriod,
            version: '1.0',
          },
        };
        const jsonStr = JSON.stringify(reportWithMetadata, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `balencia-report-${reportPeriod}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('JSON report downloaded successfully!');
      } else {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
          const endpoint = format === 'pdf' ? '/reports/download/pdf' : '/reports/download/csv';
        
        // Get token from api client
        const token = api.getAccessToken();
        
        const response = await fetch(`${API_URL}${endpoint}?period=${reportPeriod}`, {
            method: 'GET',
            headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            },
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balencia-report-${reportPeriod}-${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success(`${format.toUpperCase()} report downloaded successfully!`);
          } else {
            throw new Error('Failed to download report');
        }
      }
    } catch (err) {
      console.error('Failed to export report:', err);
      toast.error(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const periodDisplay = useMemo(() => {
    const now = new Date();
    const periodMap = {
      week: { days: 7, label: 'Last 7 days' },
      month: { days: 30, label: 'Last 30 days' },
      quarter: { days: 90, label: 'Last 90 days' },
      year: { days: 365, label: 'Last year' },
    };
    const period = periodMap[reportPeriod];
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period.days);
    return {
      label: period.label,
      range: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    };
  }, [reportPeriod]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-slate-700 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-slate-700 rounded w-64 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4 text-lg font-semibold">{error || 'No data available'}</p>
          <motion.button
            onClick={() => fetchReportData()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium"
          >
            Retry
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-[16px] sm:text-[18px] font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            Health Report
          </h2>
          <p className="text-slate-400 text-sm mt-1">{data.summary.period}</p>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => fetchReportData(true)}
            disabled={isRefreshing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter', 'year'] as const).map((period) => (
              <motion.button
              key={period}
              onClick={() => setReportPeriod(period)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                reportPeriod === period
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {period}
              </motion.button>
          ))}
        </div>
      </div>
        </motion.div>

      {/* Period Summary */}
        <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20"
      >
        <p className="text-sm text-slate-300">
          <strong className="text-white">{periodDisplay.label}</strong> • {periodDisplay.range}
        </p>
        </motion.div>

      {/* Export Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        className="flex gap-2 flex-wrap"
      >
        <ExportButton format="pdf" onClick={() => handleExport('pdf')} isGenerating={isGenerating} />
        <ExportButton format="csv" onClick={() => handleExport('csv')} isGenerating={isGenerating} />
        <ExportButton format="json" onClick={() => handleExport('json')} isGenerating={isGenerating} />
        </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedStatCard
          icon={Target}
          label="Completed Activities"
          value={data.summary.completedActivities}
          subtitle={`of ${data.summary.totalActivities} total`}
          color="purple"
          delay={0}
        />
        <AnimatedStatCard
          icon={BarChart3}
          label="Completion Rate"
          value={`${data.summary.completionRate}%`}
          color="blue"
          delay={0.1}
        />
        <AnimatedStatCard
          icon={Award}
          label="Average Score"
          value={data.summary.averageScore}
          color="green"
          delay={0.2}
        />
        <AnimatedStatCard
          icon={Award}
          label="Achievements"
          value={data.summary.achievements.length}
          color="orange"
          delay={0.3}
        />
      </div>

      {/* Weekly Report Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          Weekly Performance
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.weeklyReport}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="week"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            />
            <Legend />
            <Bar dataKey="completed" fill="#8b5cf6" name="Completed" radius={[8, 8, 0, 0]} />
            <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Category Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Category Performance
        </h3>
        <div className="space-y-3">
          {data.categoryPerformance.length > 0 ? (
            data.categoryPerformance.map((category, index) => (
              <CategoryProgressBar key={index} {...category} index={index} />
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No category data available</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Goal Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Goal Progress
        </h3>
        <div className="space-y-3">
          {data.goalProgress.length > 0 ? (
            data.goalProgress.map((goal, index) => <GoalProgressCard key={index} {...goal} index={index} />)
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No active goals</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-purple-400" />
          Recommendations
        </h3>
        <div className="space-y-3">
          {data.recommendations.length > 0 ? (
            data.recommendations.map((rec, index) => <RecommendationCard key={index} recommendation={rec} index={index} />)
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No recommendations at this time</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Health Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Health Trends
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.healthTrends.length > 0 ? (
            data.healthTrends.map((trend, index) => <TrendCard key={index} trend={trend} index={index} />)
          ) : (
            <div className="col-span-2 text-center py-8 text-slate-400">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No trend data available</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Optional: Emotion Analysis */}
      {data.emotionAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-purple-400" />
            Emotion Analysis
          </h3>
          <div className="space-y-3">
            {data.emotionAnalysis.dominantEmotions.map((emotion, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white capitalize">{emotion.emotion}</p>
                  <p className="text-sm text-slate-400">{emotion.percentage}%</p>
                </div>
                <AnimatedProgressBar
                  value={emotion.percentage}
                  color="bg-gradient-to-r from-pink-500 to-purple-600"
                  delay={index * 0.1}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Optional: Call History */}
      {data.callHistory && data.callHistory.totalCalls > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-slate-900/50 rounded-xl p-6 border border-white/10 backdrop-blur-sm"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-purple-400" />
            Voice Call History
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatedStatCard
              icon={Phone}
              label="Total Calls"
              value={data.callHistory.totalCalls}
              color="blue"
              delay={0}
            />
            <AnimatedStatCard
              icon={Clock}
              label="Avg Duration"
              value={`${Math.round(data.callHistory.averageDuration / 60)}m`}
              color="green"
              delay={0.1}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
