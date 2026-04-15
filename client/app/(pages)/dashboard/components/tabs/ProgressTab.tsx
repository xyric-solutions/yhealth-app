'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Ruler,
  Camera,
  Flame,
  Trophy,
  Loader2,
  Plus,
  RefreshCw,
  Calendar,
  Activity,
  Target,
  Filter,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { WeightTrendChart } from '../progress/WeightTrendChart';
import { BMITrendChart } from '../progress/BMITrendChart';
import { WeeklyProgressChart } from '../progress/WeeklyProgressChart';
import { MonthlyProgressChart } from '../progress/MonthlyProgressChart';
import { MeasurementTrendChart } from '../progress/MeasurementTrendChart';
import {
  calculateBMI,
  getBMICategory,
  filterByDateRange,
  calculateWeeklyChange,
  calculateConsistencyScore,
  getTimePeriodLabel,
} from '../progress/utils/progressCalculations';
import { LogMeasurementsModal } from './progress/LogMeasurementsModal';
import { UploadPhotoModal } from './progress/UploadPhotoModal';
import { PhotoComparisonWithAI } from './progress/PhotoComparisonWithAI';
import toast from 'react-hot-toast';
import { DashboardUnderlineTabs } from '../DashboardUnderlineTabs';

// Types
interface WeightRecord {
  date: string;
  weightKg: number;
}

interface BodyMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  bicepLeft?: number;
  bicepRight?: number;
  thighLeft?: number;
  thighRight?: number;
  calfLeft?: number;
  calfRight?: number;
  neck?: number;
  shoulders?: number;
}

interface MeasurementRecord {
  date: string;
  measurements: BodyMeasurements;
}

interface ProgressPhoto {
  id: string;
  recordDate: string;
  photoType: 'front' | 'side' | 'back';
  photoUrl?: string;
}

interface AssessmentResponse {
  bodyStats?: {
    heightCm?: number;
  };
  baselineData?: {
    bodyStats?: {
      heightCm?: number;
    };
  };
  body_stats?: {
    heightCm?: number;
  };
  responses?: Array<{
    questionId?: string;
    question?: string;
    answer?: string | number;
  }>;
}

interface UserProfile {
  heightCm?: number;
  height?: number;
}

interface ApiError {
  message?: string;
  response?: {
    data?: {
      error?: string | { message?: string };
    };
    status?: number;
  };
  statusCode?: number;
}

interface ProgressSummary {
  weight: {
    current: number | null;
    starting: number | null;
    lowest: number | null;
    highest: number | null;
    change: number | null;
    trend: 'up' | 'down' | 'stable';
    history: WeightRecord[];
  };
  measurements: {
    current: BodyMeasurements | null;
    starting: BodyMeasurements | null;
    changes: Partial<BodyMeasurements> | null;
  };
  photos: {
    count: number;
    latest: ProgressPhoto[];
    firstSet: ProgressPhoto[];
  };
  streak: {
    current: number;
    longest: number;
  };
  workouts: {
    totalCompleted: number;
    thisWeek: number;
    thisMonth: number;
  };
}


// Enhanced Stat Card Component
function StatCard({
  icon,
  label,
  value,
  change,
  color,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number | null;
  color: string;
  subtitle?: string;
}) {
  // Map color classes to accent bar colors
  const accentColor = color.includes('emerald')
    ? 'from-emerald-400 to-emerald-500'
    : color.includes('orange')
    ? 'from-orange-400 to-amber-500'
    : color.includes('blue')
    ? 'from-blue-400 to-blue-500'
    : color.includes('red')
    ? 'from-red-400 to-red-500'
    : 'from-emerald-400 to-teal-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl hover:border-white/[0.12] transition-all duration-300"
    >
      {/* Colored left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${accentColor} rounded-l-2xl`} />

      {/* Subtle ambient glow on hover */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${accentColor} opacity-0 group-hover:opacity-[0.06] blur-3xl transition-opacity duration-500`} />

      <div className="relative p-4 sm:p-5 pl-5 sm:pl-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-0.5">{label}</span>
            {subtitle && <span className="text-[10px] sm:text-xs text-slate-600 block truncate">{subtitle}</span>}
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${color} flex items-center justify-center shrink-0 ring-1 ring-white/[0.06]`}>
            {icon}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="text-2xl sm:text-[28px] font-bold tracking-tight bg-gradient-to-br from-white via-white to-slate-300 bg-clip-text text-transparent truncate leading-tight">{value}</span>
          {change !== undefined && change !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center text-[11px] sm:text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ring-1 ${
                change > 0
                  ? 'text-red-400 bg-red-500/[0.08] ring-red-500/20'
                  : change < 0
                  ? 'text-emerald-400 bg-emerald-500/[0.08] ring-emerald-500/20'
                  : 'text-slate-400 bg-slate-500/[0.08] ring-slate-500/20'
              }`}
            >
              {change > 0 ? <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" /> : change < 0 ? <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" /> : <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />}
              {Math.abs(change).toFixed(1)} kg
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Measurement Row Component
function MeasurementRow({
  label,
  current,
  change,
  index,
}: {
  label: string;
  current?: number;
  change?: number;
  index?: number;
}) {
  if (current === undefined) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (index || 0) * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ x: 3 }}
      className="group relative flex items-center justify-between py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 border border-white/[0.06] hover:border-teal-500/20 backdrop-blur-sm"
    >
      {/* Subtle left accent on hover */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-[60%] bg-gradient-to-b from-teal-400 to-cyan-400 rounded-full transition-all duration-300" />

      <span className="text-slate-400 font-medium text-sm sm:text-[13px] group-hover:text-slate-200 transition-colors duration-200 pl-1">{label}</span>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-white font-semibold text-base sm:text-lg tabular-nums tracking-tight">
          {current} <span className="text-slate-500 text-xs font-normal">cm</span>
        </span>
        {change !== undefined && change !== 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:py-1 rounded-md ring-1 ${
              change > 0
                ? 'text-red-400 bg-red-500/[0.08] ring-red-500/20'
                : 'text-emerald-400 bg-emerald-500/[0.08] ring-emerald-500/20'
            }`}
          >
            {change > 0 ? '+' : ''}{change.toFixed(1)}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

// Photo Comparison Component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PhotoComparison({
  firstSet,
  latestSet,
  onUploadClick,
}: {
  firstSet: ProgressPhoto[];
  latestSet: ProgressPhoto[];
  onUploadClick?: () => void;
}) {
  const [selectedType, setSelectedType] = useState<'front' | 'side' | 'back'>('front');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const firstPhoto = firstSet.find((p) => p.photoType === selectedType);
  const latestPhoto = latestSet.find((p) => p.photoType === selectedType);

  const handleImageError = (photoId: string) => {
    setImageErrors((prev) => new Set(prev).add(photoId));
  };

  if (firstSet.length === 0 && latestSet.length === 0) {
    return (
      <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-500/20 flex items-center justify-center">
            <Camera className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white mb-1">No progress photos yet</p>
            <p className="text-sm text-slate-400 mb-6">
              Upload before and after photos to track your visual progress
            </p>
            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-medium rounded-xl transition-all flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Upload Your First Photo
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl"
    >
      {/* Photo Type Selector */}
      <div className="flex border-b border-white/10 bg-white/5">
        {(['front', 'side', 'back'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`flex-1 py-4 text-sm font-medium capitalize transition-all relative ${
              selectedType === type
                ? 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-400'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {type}
            {selectedType === type && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Photo Comparison */}
      <div className="grid grid-cols-2 gap-6 p-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Before</span>
            {firstPhoto && (
              <span className="text-xs text-slate-500">{firstPhoto.recordDate}</span>
            )}
          </div>
          {firstPhoto?.photoUrl && !imageErrors.has(`first-${firstPhoto.id}`) ? (
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={firstPhoto.photoUrl}
                alt="Before"
                className="w-full h-full object-cover"
                onError={() => handleImageError(`first-${firstPhoto.id}`)}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 flex flex-col items-center justify-center shadow-lg">
              <Camera className="w-12 h-12 text-slate-600 mb-2" />
              <span className="text-xs text-slate-500">No {selectedType} photo</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">After</span>
            {latestPhoto && (
              <span className="text-xs text-slate-500">{latestPhoto.recordDate}</span>
            )}
          </div>
          {latestPhoto?.photoUrl && !imageErrors.has(`latest-${latestPhoto.id}`) ? (
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-800 border-2 border-emerald-500/30 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={latestPhoto.photoUrl}
                alt="After"
                className="w-full h-full object-cover"
                onError={() => handleImageError(`latest-${latestPhoto.id}`)}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 flex flex-col items-center justify-center shadow-lg">
              <Camera className="w-12 h-12 text-slate-600 mb-2" />
              <span className="text-xs text-slate-500">No {selectedType} photo</span>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Main Progress Tab Component
export function ProgressTab() {
  const [activeTab, setActiveTab] = useState<'weight' | 'measurements' | 'photos' | 'workouts' | 'analytics'>('weight');
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [timePeriod, setTimePeriod] = useState<number | null>(90); // Default to 90 days
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementRecord[]>([]);

  // Fetch user height from assessment - try multiple sources
  const fetchUserHeight = useCallback(async () => {
    try {
      // Try to get from assessment responses
      const assessmentResponse = await api.get<AssessmentResponse>('/assessment/goals');
      if (assessmentResponse.success && assessmentResponse.data) {
        const data = assessmentResponse.data;
        
        // Try different possible structures for bodyStats
        let heightCm: number | null = null;
        
        // Structure 1: Direct bodyStats
        if (data.bodyStats?.heightCm && typeof data.bodyStats.heightCm === 'number') {
          heightCm = data.bodyStats.heightCm;
        }
        // Structure 2: Nested in baselineData
        else if (data.baselineData?.bodyStats?.heightCm && typeof data.baselineData.bodyStats.heightCm === 'number') {
          heightCm = data.baselineData.bodyStats.heightCm;
        }
        // Structure 3: In assessment response body_stats field
        else if (data.body_stats?.heightCm && typeof data.body_stats.heightCm === 'number') {
          heightCm = data.body_stats.heightCm;
        }
        // Structure 4: Try to find in responses array
        else if (Array.isArray(data.responses)) {
          const heightResponse = data.responses.find((r) => 
            r.questionId?.toLowerCase().includes('height') || 
            r.question?.toLowerCase().includes('height')
          );
          if (heightResponse?.answer) {
            const heightValue = typeof heightResponse.answer === 'number' 
              ? heightResponse.answer 
              : parseFloat(String(heightResponse.answer));
            if (!isNaN(heightValue) && heightValue > 50 && heightValue < 300) {
              heightCm = heightValue; // Reasonable range for height in cm
            }
          }
        }
        
        if (heightCm && heightCm > 0) {
          setUserHeight(heightCm);
          console.log('[ProgressTab] User height fetched:', heightCm, 'cm');
        }
      }
      
      // Also try to get from user profile/auth endpoint
      try {
        const profileResponse = await api.get<{ user?: UserProfile }>('/auth/me');
        if (profileResponse.success && profileResponse.data?.user) {
          const user = profileResponse.data.user;
          // Check various possible fields
          if (user.heightCm && typeof user.heightCm === 'number') {
            setUserHeight(user.heightCm);
          } else if (user.height && typeof user.height === 'number') {
            setUserHeight(user.height);
          }
        }
      } catch (_profileErr) {
        // Ignore profile fetch errors - height is optional
      }
    } catch (err) {
      console.warn('[ProgressTab] Could not fetch user height:', err);
      // Height is optional - BMI chart will show a message if height is not available
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      setError(null);
      if (!isRefreshing) {
        setIsLoading(true);
      }
      
      console.log('[ProgressTab] Fetching progress summary...');
      const response = await api.get<{ summary: ProgressSummary }>('/progress/summary');
      
      if (response.success && response.data) {
        // Server returns: { success: true, data: { summary: ... } }
        // API client returns: { success: true, data: { summary: ... } }
        // So we access: response.data.summary
        const summaryData = response.data.summary;
        
        console.log('[ProgressTab] Summary data received:', {
          hasSummary: !!summaryData,
          hasWeight: !!summaryData?.weight,
          hasHistory: !!summaryData?.weight?.history,
          historyLength: summaryData?.weight?.history?.length || 0,
          historyIsArray: Array.isArray(summaryData?.weight?.history),
          firstItem: summaryData?.weight?.history?.[0],
          lastItem: summaryData?.weight?.history?.[summaryData?.weight?.history?.length - 1],
          weightCurrent: summaryData?.weight?.current,
          weightStarting: summaryData?.weight?.starting,
          measurementsCount: summaryData?.measurements ? 1 : 0,
          photosCount: summaryData?.photos?.count || 0,
          streakCurrent: summaryData?.streak?.current || 0,
          workoutsTotal: summaryData?.workouts?.totalCompleted || 0,
        });
        
        if (summaryData) {
          // Ensure history is an array and properly formatted
          if (summaryData.weight && summaryData.weight.history) {
            if (!Array.isArray(summaryData.weight.history)) {
              console.warn('[ProgressTab] Weight history is not an array, converting...');
              summaryData.weight.history = [];
            } else {
              // Validate history items have required fields
              summaryData.weight.history = summaryData.weight.history.filter((item) => {
                const isValid = item && 
                  typeof item.date === 'string' && 
                  typeof item.weightKg === 'number' && 
                  !isNaN(item.weightKg);
                if (!isValid) {
                  console.warn('[ProgressTab] Invalid weight history item:', item);
                }
                return isValid;
              });
              
              console.log('[ProgressTab] Validated weight history:', {
                originalLength: summaryData.weight.history.length,
                filteredLength: summaryData.weight.history.length,
              });
            }
          }
          
          setSummary(summaryData);
          setLastUpdated(new Date());
          console.log('[ProgressTab] Summary set successfully');
        } else {
          console.warn('[ProgressTab] Summary data is null or undefined - user may not have logged data yet');
          // Set empty summary instead of error - user might not have logged data yet
          setSummary(null);
          setLastUpdated(new Date());
        }
      } else {
        console.error('[ProgressTab] Invalid response structure:', {
          success: response.success,
          hasData: !!response.data,
          response: response,
        });
        setError('Failed to load progress data. Invalid response from server.');
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error('[ProgressTab] Failed to fetch progress summary:', {
        error: err,
        message: apiError?.message,
        response: apiError?.response?.data,
        status: apiError?.statusCode || apiError?.response?.status,
      });
      
      // Handle different error types
      let errorMessage = 'Failed to load progress data. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('Network') || err.message.includes('connect')) {
          errorMessage = 'Unable to connect to server. Please check your connection.';
        } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'Please sign in to view your progress.';
        } else {
          errorMessage = err.message || errorMessage;
        }
      } else if (apiError?.response?.data?.error) {
        const errorData = apiError.response.data.error;
        errorMessage = typeof errorData === 'string' 
          ? errorData 
          : (errorData && typeof errorData === 'object' && 'message' in errorData && typeof errorData.message === 'string')
            ? errorData.message 
            : errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSummary();
  }, [fetchSummary]);

  // Fetch measurement history
  const fetchMeasurementHistory = useCallback(async () => {
    try {
      const response = await api.get<{ history?: MeasurementRecord[] }>('/progress/measurements');
      if (response.success && response.data) {
        // API returns { success: true, data: { history: [...] } }
        const history = response.data.history || [];
        setMeasurementHistory(Array.isArray(history) ? history : []);
      }
    } catch (err) {
      console.error('[ProgressTab] Failed to fetch measurement history:', err);
      setMeasurementHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchUserHeight();
    fetchMeasurementHistory();
  }, [fetchSummary, fetchUserHeight, fetchMeasurementHistory]);

  // Listen for custom event to open weight modal from chart empty state
  useEffect(() => {
    const handleOpenWeightModal = () => {
      setShowWeightModal(true);
    };
    
    window.addEventListener('openWeightModal', handleOpenWeightModal);
    return () => {
      window.removeEventListener('openWeightModal', handleOpenWeightModal);
    };
  }, []);

  // Extract data from summary with defaults
  const defaultSummary = {
    weight: { current: null, starting: null, lowest: null, highest: null, change: null, trend: 'stable' as const, history: [] },
    measurements: { current: null, starting: null, changes: null },
    photos: { count: 0, latest: [], firstSet: [] },
    streak: { current: 0, longest: 0 },
    workouts: { totalCompleted: 0, thisWeek: 0, thisMonth: 0 },
  };

  const { weight, measurements, photos, streak, workouts } = summary || defaultSummary;

  // Debug: Log weight history structure when summary changes
  useEffect(() => {
    if (summary) {
      console.log('[ProgressTab] Summary structure:', {
        hasWeight: !!summary.weight,
        hasHistory: !!summary.weight?.history,
        historyLength: summary.weight?.history?.length || 0,
        historyType: Array.isArray(summary.weight?.history) ? 'array' : typeof summary.weight?.history,
        firstItem: summary.weight?.history?.[0],
        weightCurrent: summary.weight?.current,
      });
    } else {
      console.log('[ProgressTab] Summary is null - using defaults');
    }
  }, [summary]);

  // Calculate BMI and other metrics
  const currentBMI = useMemo(() => {
    if (!userHeight || !weight?.current) return null;
    return calculateBMI(weight.current, userHeight);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userHeight, weight?.current]);

  const bmiCategory = useMemo(() => {
    if (!currentBMI) return null;
    return getBMICategory(currentBMI);
  }, [currentBMI]);

  const weeklyChange = useMemo(() => {
    if (!weight?.history || weight.history.length === 0) return null;
    return calculateWeeklyChange(weight.history);
  }, [weight?.history]);

  const consistencyScore = useMemo(() => {
    if (!weight?.history || weight.history.length === 0) return 0;
    return calculateConsistencyScore(weight.history, 4);
  }, [weight?.history]);

  // Filter data by time period
  const filteredWeightHistory = useMemo(() => {
    if (!weight || !weight.history || !Array.isArray(weight.history)) {
      console.log('[ProgressTab] No weight history available for filtering');
      return [];
    }
    
    if (weight.history.length === 0) {
      console.log('[ProgressTab] Weight history is empty');
      return [];
    }
    
    // Ensure all items have required fields
    const validHistory = weight.history.filter((item) => {
      const isValid = item && 
        typeof item.date === 'string' && 
        typeof item.weightKg === 'number' && 
        !isNaN(item.weightKg) &&
        item.weightKg > 0;
      return isValid;
    });
    
    if (validHistory.length !== weight.history.length) {
      console.warn('[ProgressTab] Filtered out invalid weight history items:', {
        original: weight.history.length,
        valid: validHistory.length,
      });
    }
    
    if (validHistory.length === 0) {
      console.log('[ProgressTab] No valid weight history items after filtering');
      return [];
    }
    
    // Apply time period filter if specified
    const filtered = timePeriod 
      ? filterByDateRange(validHistory, timePeriod)
      : validHistory;
    
    console.log('[ProgressTab] Filtered weight history:', {
      originalLength: weight.history.length,
      validLength: validHistory.length,
      filteredLength: filtered.length,
      timePeriod: timePeriod || 'all',
      firstDate: filtered[0]?.date,
      lastDate: filtered[filtered.length - 1]?.date,
    });
    
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weight?.history, timePeriod]);

  const handleLogWeight = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;

    setIsSaving(true);
    try {
      const response = await api.post('/progress/weight', { weightKg: weight });
      if (response.success) {
        setShowWeightModal(false);
        setWeightInput('');
        setError(null);
        toast.success('Weight logged successfully!');
        await fetchSummary();
      } else {
        toast.error('Failed to log weight. Please try again.');
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to log weight:', err);
      let errorMessage = 'Failed to log weight. Please try again.';
      if (apiError?.message && typeof apiError.message === 'string') {
        errorMessage = apiError.message;
      } else if (apiError?.response?.data?.error) {
        const errorData = apiError.response.data.error;
        errorMessage = typeof errorData === 'string' 
          ? errorData 
          : (errorData && typeof errorData === 'object' && 'message' in errorData && typeof errorData.message === 'string')
            ? errorData.message 
            : errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMeasurementSuccess = useCallback(() => {
    fetchSummary();
    fetchMeasurementHistory();
  }, [fetchSummary, fetchMeasurementHistory]);

  const handlePhotoSuccess = useCallback(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load progress data</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchSummary}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const measurementLabels: Record<keyof BodyMeasurements, string> = {
    chest: 'Chest',
    waist: 'Waist',
    hips: 'Hips',
    bicepLeft: 'Left Bicep',
    bicepRight: 'Right Bicep',
    thighLeft: 'Left Thigh',
    thighRight: 'Right Thigh',
    calfLeft: 'Left Calf',
    calfRight: 'Right Calf',
    neck: 'Neck',
    shoulders: 'Shoulders',
  };

  const tabItems = [
    { id: 'weight' as const, label: 'Weight', icon: Scale },
    { id: 'measurements' as const, label: 'Measurements', icon: Ruler },
    { id: 'photos' as const, label: 'Photos', icon: Camera },
    // { id: 'workouts' as const, label: 'Workouts', icon: Trophy },
    // { id: 'analytics' as const, label: 'Analytics', icon: Target },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative space-y-6 sm:space-y-8"
    >
      {/* Ambient background glow elements */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
      <div className="pointer-events-none absolute -top-20 right-0 w-64 h-64 rounded-full bg-cyan-500/[0.03] blur-[80px]" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Icon badge */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center ring-1 ring-white/[0.08]">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Progress
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-slate-500">Monitor your health journey</p>
              {lastUpdated && (
                <>
                  <span className="text-slate-700">|</span>
                  <p className="text-xs text-slate-600">
                    {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 border border-white/[0.06] hover:border-white/[0.1] rounded-xl transition-all duration-200 disabled:opacity-50 backdrop-blur-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
          {activeTab === 'weight' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowWeightModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              <Plus className="w-4 h-4" />
              Log Weight
            </motion.button>
          )}
          {activeTab === 'measurements' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowMeasurementsModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
            >
              <Plus className="w-4 h-4" />
              Log Measurements
            </motion.button>
          )}
          {activeTab === 'photos' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPhotoModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              <Plus className="w-4 h-4" />
              Upload Photo
            </motion.button>
          )}
        </div>
      </div>

      <DashboardUnderlineTabs
        layoutId="progressSubTabUnderline"
        activeId={activeTab}
        onTabChange={(id) => setActiveTab(id as typeof activeTab)}
        tabs={tabItems.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
      />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'weight' && (
          <motion.div
            key="weight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* Filter Bar - Minimal, integrated */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-xs uppercase tracking-wider text-slate-600 font-semibold">Period</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[7, 30, 90, 180, 365, null].map((days) => (
                    <button
                      key={days || 'all'}
                      onClick={() => setTimePeriod(days)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                        timePeriod === days
                          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      {days ? `${days}d` : 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-600 font-semibold">View</span>
                <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5 ring-1 ring-white/[0.04]">
                  {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize ${
                        viewMode === mode
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                icon={<Scale className="w-5 h-5 text-white" />}
                label="Current Weight"
                value={weight.current ? `${weight.current} kg` : '—'}
                change={weight.change}
                color="bg-emerald-500/20"
                subtitle={weight.starting ? `Started: ${weight.starting} kg` : undefined}
              />
              {currentBMI && bmiCategory && (
                <StatCard
                  icon={<Activity className="w-5 h-5 text-white" />}
                  label="BMI"
                  value={currentBMI.toFixed(1)}
                  color={`${bmiCategory.category === 'Normal' ? 'bg-emerald-500/20' : bmiCategory.category === 'Underweight' ? 'bg-blue-500/20' : bmiCategory.category === 'Overweight' ? 'bg-orange-500/20' : 'bg-red-500/20'}`}
                  subtitle={bmiCategory.category}
                />
              )}
              <StatCard
                icon={<Flame className="w-5 h-5 text-white" />}
                label="Current Streak"
                value={`${streak.current} days`}
                color="bg-orange-500/20"
                subtitle={streak.longest > streak.current ? `Best: ${streak.longest} days` : undefined}
              />
            </div>

            {/* Analytics Insights - Redesigned */}
            {(weeklyChange !== null || consistencyScore > 0) && (
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl">
                {/* Subtle gradient accent at top */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                      <Target className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Insights</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {weeklyChange !== null && (
                      <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-xl" />
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2 pl-2">Weekly Change</p>
                        <p className={`text-xl sm:text-2xl font-bold tracking-tight pl-2 ${weeklyChange < 0 ? 'text-emerald-400' : weeklyChange > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)}
                          <span className="text-sm font-normal text-slate-500 ml-1">kg/wk</span>
                        </p>
                      </div>
                    )}
                    <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400 to-blue-500 rounded-l-xl" />
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2 pl-2">Consistency</p>
                      <p className="text-xl sm:text-2xl font-bold text-cyan-400 tracking-tight pl-2">
                        {consistencyScore}
                        <span className="text-sm font-normal text-slate-500 ml-0.5">%</span>
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1 pl-2">Last 4 weeks</p>
                    </div>
                    {filteredWeightHistory.length > 0 && (
                      <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-slate-400 to-slate-500 rounded-l-xl" />
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2 pl-2">Data Points</p>
                        <p className="text-xl sm:text-2xl font-bold text-white tracking-tight pl-2">{filteredWeightHistory.length}</p>
                        <p className="text-[10px] text-slate-600 mt-1 pl-2">{getTimePeriodLabel(timePeriod)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Charts Section */}
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
                {/* Weight Trend Chart - Glass card */}
                <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-[15px] font-semibold text-white tracking-tight">Weight Trend</h3>
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {weight.trend === 'down' && (
                          <span className="flex items-center text-emerald-400 bg-emerald-500/[0.08] px-2.5 py-1 rounded-lg ring-1 ring-emerald-500/20">
                            <TrendingDown className="w-3.5 h-3.5 mr-1" />
                            Losing
                          </span>
                        )}
                        {weight.trend === 'up' && (
                          <span className="flex items-center text-red-400 bg-red-500/[0.08] px-2.5 py-1 rounded-lg ring-1 ring-red-500/20">
                            <TrendingUp className="w-3.5 h-3.5 mr-1" />
                            Gaining
                          </span>
                        )}
                        {weight.trend === 'stable' && (
                          <span className="flex items-center text-slate-400 bg-slate-500/[0.08] px-2.5 py-1 rounded-lg ring-1 ring-slate-500/20">
                            <Minus className="w-3.5 h-3.5 mr-1" />
                            Stable
                          </span>
                        )}
                      </div>
                    </div>
                    {viewMode === 'daily' && (
                      <WeightTrendChart
                        history={filteredWeightHistory}
                        timePeriod={timePeriod}
                        showTrendLine={true}
                      />
                    )}
                    {viewMode === 'weekly' && (
                      <>
                        {filteredWeightHistory.length > 0 ? (
                          <WeeklyProgressChart
                            weightHistory={filteredWeightHistory}
                            timePeriod={timePeriod}
                          />
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center text-slate-500 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                            <Calendar className="w-10 h-10 mb-3 text-slate-600" />
                            <p className="text-sm font-medium text-slate-400 mb-1">No weekly data</p>
                            <p className="text-xs text-slate-600 mb-4">Log weight to see weekly breakdown</p>
                            <button
                              onClick={() => setShowWeightModal(true)}
                              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 rounded-lg transition-all duration-200 text-xs font-medium ring-1 ring-emerald-500/20"
                            >
                              Log Your First Weight
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {viewMode === 'monthly' && (
                      <>
                        {filteredWeightHistory.length > 0 ? (
                          <MonthlyProgressChart weightHistory={filteredWeightHistory} />
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center text-slate-500 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                            <Calendar className="w-10 h-10 mb-3 text-slate-600" />
                            <p className="text-sm font-medium text-slate-400 mb-1">No monthly data</p>
                            <p className="text-xs text-slate-600 mb-4">Log weight to see monthly breakdown</p>
                            <button
                              onClick={() => setShowWeightModal(true)}
                              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 rounded-lg transition-all duration-200 text-xs font-medium ring-1 ring-emerald-500/20"
                            >
                              Log Your First Weight
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Weight Stats - Refined */}
                    <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/[0.06]">
                      <div className="text-center">
                        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold block mb-1">Starting</span>
                        <span className="text-base sm:text-lg font-semibold text-slate-300 tabular-nums">
                          {weight.starting ? `${weight.starting}` : '—'}
                        </span>
                        {weight.starting && <span className="text-[10px] text-slate-600 ml-0.5">kg</span>}
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold block mb-1">Lowest</span>
                        <span className="text-base sm:text-lg font-semibold text-emerald-400 tabular-nums">
                          {weight.lowest ? `${weight.lowest}` : '—'}
                        </span>
                        {weight.lowest && <span className="text-[10px] text-emerald-600 ml-0.5">kg</span>}
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold block mb-1">Highest</span>
                        <span className="text-base sm:text-lg font-semibold text-red-400 tabular-nums">
                          {weight.highest ? `${weight.highest}` : '—'}
                        </span>
                        {weight.highest && <span className="text-[10px] text-red-600 ml-0.5">kg</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BMI Chart - Glass card */}
                <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-[15px] font-semibold text-white tracking-tight">BMI Trend</h3>
                      {currentBMI && bmiCategory && (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ring-1 ${
                          bmiCategory.category === 'Normal' ? 'text-emerald-400 bg-emerald-500/[0.08] ring-emerald-500/20'
                          : bmiCategory.category === 'Underweight' ? 'text-blue-400 bg-blue-500/[0.08] ring-blue-500/20'
                          : bmiCategory.category === 'Overweight' ? 'text-orange-400 bg-orange-500/[0.08] ring-orange-500/20'
                          : 'text-red-400 bg-red-500/[0.08] ring-red-500/20'
                        }`}>
                          {bmiCategory.category}
                        </span>
                      )}
                    </div>
                    <BMITrendChart
                      weightHistory={filteredWeightHistory}
                      heightCm={userHeight}
                      timePeriod={timePeriod}
                    />
                    {!userHeight && (
                      <div className="mt-4 p-3 sm:p-4 bg-blue-500/[0.06] border border-blue-500/10 rounded-xl text-center">
                        <p className="text-xs text-blue-400 mb-1">Height required for BMI calculation</p>
                        <p className="text-[10px] text-slate-500">Update your profile with your height</p>
                      </div>
                    )}
                    {currentBMI && (
                      <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
                        <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">Current BMI</p>
                        <p className={`text-3xl font-bold tracking-tight ${bmiCategory?.color || 'text-white'}`}>
                          {currentBMI.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'measurements' && (
          <motion.div
            key="measurements"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* Body Measurements Section - Glass card */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-teal-500/10 flex items-center justify-center ring-1 ring-teal-500/20 shrink-0">
                      <Ruler className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Body Measurements</h3>
                      <p className="text-xs sm:text-sm text-slate-500">Track your body composition changes</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowMeasurementsModal(true)}
                    className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-sm bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-teal-500/20 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Log Measurements
                  </motion.button>
                </div>

                {measurements.current ? (
                  <>
                    {/* Measurement List */}
                    <div className="grid md:grid-cols-2 gap-2.5 sm:gap-3 mb-8">
                      {(Object.keys(measurementLabels) as (keyof BodyMeasurements)[]).map((key, index) => (
                        <MeasurementRow
                          key={key}
                          label={measurementLabels[key]}
                          current={measurements.current?.[key]}
                          change={measurements.changes?.[key]}
                          index={index}
                        />
                      ))}
                    </div>

                    {/* Measurement Trend Chart */}
                    {measurementHistory.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-white/[0.06]">
                        <div className="mb-4">
                          <h4 className="text-[15px] font-semibold text-white tracking-tight mb-1">Measurement Trends</h4>
                          <p className="text-xs text-slate-500">Track your progress over time</p>
                        </div>
                        <MeasurementTrendChart history={measurementHistory} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 sm:py-16">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/10 flex items-center justify-center ring-1 ring-teal-500/20">
                        <Ruler className="w-7 h-7 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white mb-1">No measurements yet</p>
                        <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
                          Track your body measurements to visualize changes over time
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowMeasurementsModal(true)}
                          className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-teal-500/20"
                        >
                          Log Your First Measurement
                        </motion.button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'photos' && (
          <motion.div
            key="photos"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* AI-Powered Photo Comparison */}
            <PhotoComparisonWithAI
              firstSet={photos.firstSet}
              latestSet={photos.latest}
              onUploadClick={() => setShowPhotoModal(true)}
            />

            {/* Photo Gallery - Glass card */}
            {photos.latest.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5"
              >
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                        <Camera className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-white tracking-tight">Photo Gallery</h3>
                        <p className="text-xs text-slate-500">{photos.count} photos total</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowPhotoModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      Upload
                    </motion.button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {photos.latest.map((photo, index) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
                        whileHover={{ y: -4 }}
                        className="relative group cursor-pointer"
                      >
                        {photo.photoUrl ? (
                          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-800/50 ring-1 ring-white/[0.06] group-hover:ring-emerald-500/30 transition-all duration-300 shadow-lg group-hover:shadow-xl group-hover:shadow-emerald-500/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.photoUrl}
                              alt={`${photo.photoType} photo`}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                              <div className="text-white">
                                <div className="font-medium capitalize text-xs">{photo.photoType}</div>
                                <div className="text-slate-400 text-[10px]">{new Date(photo.recordDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[3/4] rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] flex items-center justify-center">
                            <Camera className="w-7 h-7 text-slate-700" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === 'workouts' && (
          <motion.div
            key="workouts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* Workout Stats - Glass card */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
                    <Trophy className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white tracking-tight">Workout Summary</h3>
                    <p className="text-xs text-slate-500">Your fitness activity overview</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { value: workouts.thisWeek, label: 'This Week', gradient: 'from-emerald-400 to-teal-400', delay: 0.05 },
                    { value: workouts.thisMonth, label: 'This Month', gradient: 'from-teal-400 to-cyan-400', delay: 0.1 },
                    { value: workouts.totalCompleted, label: 'Total Completed', gradient: 'from-white to-slate-300', delay: 0.15 },
                  ].map((stat) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: stat.delay, type: 'spring', stiffness: 300, damping: 26 }}
                      className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 sm:p-5 text-center"
                    >
                      <div className={`text-3xl sm:text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-1 tabular-nums tracking-tight`}>
                        {stat.value}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* Analytics Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              {/* BMI Chart - Glass card */}
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[15px] font-semibold text-white tracking-tight">BMI Trend</h3>
                    {currentBMI && bmiCategory && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ring-1 ${
                        bmiCategory.category === 'Normal' ? 'text-emerald-400 bg-emerald-500/[0.08] ring-emerald-500/20'
                        : bmiCategory.category === 'Underweight' ? 'text-blue-400 bg-blue-500/[0.08] ring-blue-500/20'
                        : bmiCategory.category === 'Overweight' ? 'text-orange-400 bg-orange-500/[0.08] ring-orange-500/20'
                        : 'text-red-400 bg-red-500/[0.08] ring-red-500/20'
                      }`}>
                        {bmiCategory.category}
                      </span>
                    )}
                  </div>
                  <BMITrendChart
                    weightHistory={filteredWeightHistory}
                    heightCm={userHeight}
                    timePeriod={timePeriod}
                  />
                  {!userHeight && (
                    <div className="mt-4 p-3 bg-blue-500/[0.06] border border-blue-500/10 rounded-xl text-center">
                      <p className="text-xs text-blue-400 mb-1">Height required for BMI calculation</p>
                      <p className="text-[10px] text-slate-500">Update your profile with your height</p>
                    </div>
                  )}
                  {currentBMI && (
                    <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">Current BMI</p>
                      <p className={`text-3xl font-bold tracking-tight ${bmiCategory?.color || 'text-white'}`}>
                        {currentBMI.toFixed(1)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Analytics Insights - Glass card */}
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-xl shadow-black/5">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                      <Target className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Progress Insights</h3>
                  </div>
                  <div className="space-y-3">
                    {weeklyChange !== null && (
                      <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 sm:p-4">
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-xl" />
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 pl-2">Weekly Change</p>
                        <p className={`text-xl sm:text-2xl font-bold tracking-tight pl-2 ${weeklyChange < 0 ? 'text-emerald-400' : weeklyChange > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)} <span className="text-sm font-normal text-slate-500">kg/wk</span>
                        </p>
                      </div>
                    )}
                    <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 sm:p-4">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400 to-blue-500 rounded-l-xl" />
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 pl-2">Consistency</p>
                      <p className="text-xl sm:text-2xl font-bold text-cyan-400 tracking-tight pl-2">
                        {consistencyScore}<span className="text-sm font-normal text-slate-500 ml-0.5">%</span>
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1 pl-2">Last 4 weeks</p>
                    </div>
                    {filteredWeightHistory.length > 0 && (
                      <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 sm:p-4">
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-slate-400 to-slate-500 rounded-l-xl" />
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 pl-2">Data Points</p>
                        <p className="text-xl sm:text-2xl font-bold text-white tracking-tight pl-2">{filteredWeightHistory.length}</p>
                        <p className="text-[10px] text-slate-600 mt-1 pl-2">{getTimePeriodLabel(timePeriod)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showWeightModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowWeightModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative overflow-hidden bg-slate-900 border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/40"
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                  <Scale className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Log Weight</h3>
              </div>
              <div className="mb-5">
                <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block mb-2">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="e.g., 75.5"
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200 text-lg tabular-nums"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWeightModal(false)}
                  className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 rounded-xl transition-all duration-200 font-medium text-sm border border-white/[0.06]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogWeight}
                  disabled={isSaving || !weightInput}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LogMeasurementsModal
        isOpen={showMeasurementsModal}
        onClose={() => setShowMeasurementsModal(false)}
        onSuccess={handleMeasurementSuccess}
      />

      <UploadPhotoModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onSuccess={handlePhotoSuccess}
      />
    </motion.div>
  );
}
