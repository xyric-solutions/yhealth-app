'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, Droplet, Heart, Thermometer, Activity, Moon, Zap, AlertTriangle, Trophy, Star, Flame, Crown, Gauge } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useFetch } from '@/hooks/use-fetch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { motion } from 'framer-motion';

interface UserHealthData {
  currentRecovery?: {
    score: number;
    hrv: number;
    rhr: number;
    spo2?: number;
    skinTemp?: number;
    timestamp: string;
  } | null;
  currentSleep?: {
    duration: number;
    quality: number;
    efficiency: number;
    timestamp: string;
  } | null;
  todayStrain?: {
    score: number;
    normalized: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    calories?: number;
    timestamp: string;
  } | null;
  waterIntake?: {
    mlConsumed: number;
    targetMl: number;
    percentage: number;
    timestamp: string;
  } | null;
  stress?: {
    level: number;
    timestamp: string;
  } | null;
  _meta?: {
    hasIntegration: boolean;
    integrationStatus: string | null;
    lastSyncAt: string | null;
    hasAnyData: boolean;
    dataTypes: string[];
  };
}

interface UserHealthProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userAvatar?: string | null;
}

interface UserAchievements {
  level: number;
  totalXP: number;
  xpProgress: number;
  xpNeeded: number;
  xpProgressPercentage: number;
  totalUnlocked: number;
  totalAchievements: number;
  unlockedAchievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    rarity: string;
    xpReward: number;
  }>;
  currentStreak: number;
  longestStreak: number;
}

// Enhanced Circular Progress Indicator Component (WHOOP-style)
function CircularProgress({
  value,
  max = 100,
  size = 160,
  strokeWidth = 10,
  label,
  unit,
  icon: Icon,
  showValue = true,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  unit?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showValue?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const offset = circumference - (percentage / 100) * circumference;

  // Get color based on percentage (WHOOP-style)
  const getColor = (percent: number): string => {
    if (percent >= 75) return '#10B981'; // emerald-500
    if (percent >= 50) return '#3B82F6'; // blue-500
    if (percent >= 25) return '#F59E0B'; // amber-500
    return '#EF4444'; // red-500
  };

  const progressColor = getColor(percentage);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="stroke-slate-800"
            opacity={0.3}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s ease',
            }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && (
            <Icon 
              className="w-7 h-7 mb-2" 
              style={{ color: progressColor }}
            />
          )}
          {showValue && (
            <>
              <div 
                className="text-3xl font-bold tracking-tight"
                style={{ color: progressColor }}
              >
                {typeof value === 'number' ? value.toFixed(value < 10 ? 1 : 0) : value}
              </div>
              {unit && (
                <div className="text-xs text-slate-400 mt-0.5 font-medium">{unit}</div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export function UserHealthProfileModal({
  isOpen,
  onClose,
  userId,
  userName,
  userAvatar,
}: UserHealthProfileModalProps) {
  const { data: healthData, isLoading, error } = useFetch<UserHealthData>(
    `/whoop/analytics/user-profile?userId=${userId}`,
    {
      immediate: isOpen && !!userId,
      deps: [userId, isOpen],
    }
  );
  
  // Extract and format data for display
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sleep = healthData?.currentSleep ? {
    score: healthData.currentSleep.quality,
    duration_minutes: healthData.currentSleep.duration,
    efficiency: healthData.currentSleep.efficiency,
  } : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recovery = healthData?.currentRecovery ? {
    score: healthData.currentRecovery.score,
    hrv: healthData.currentRecovery.hrv,
    rhr: healthData.currentRecovery.rhr,
  } : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const strain = healthData?.todayStrain ? {
    score: healthData.todayStrain.score,
    normalized: healthData.todayStrain.normalized,
  } : undefined;

  const heartRate = healthData?.todayStrain && (healthData.todayStrain.avgHeartRate || healthData.todayStrain.maxHeartRate) ? {
    avg: healthData.todayStrain.avgHeartRate,
    max: healthData.todayStrain.maxHeartRate,
    resting: healthData?.currentRecovery?.rhr,
  } : undefined;

  const temperature = healthData?.currentRecovery?.skinTemp;

  const waterIntake = healthData?.waterIntake;

  const stress = healthData?.stress;

  const timestamp = healthData?.currentRecovery?.timestamp ||
                   healthData?.currentSleep?.timestamp ||
                   healthData?.todayStrain?.timestamp ||
                   healthData?.waterIntake?.timestamp ||
                   healthData?.stress?.timestamp;

  // Calculate overall health score from available metrics
  const healthScore = useMemo(() => {
    const scores: number[] = [];
    if (recovery?.score) scores.push(recovery.score);
    if (sleep?.score) scores.push(sleep.score);
    if (strain?.normalized) scores.push(Math.min(100, (strain.normalized / 21) * 100));
    if (waterIntake?.percentage) scores.push(waterIntake.percentage);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [recovery, sleep, strain, waterIntake]);

  // Get initials from name
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || '?';
  };

  // Format water intake display
  const formatWaterIntake = (ml: number) => {
    if (ml >= 1000) {
      return `${(ml / 1000).toFixed(1)}L`;
    }
    return `${ml}ml`;
  };

  // Always show sleep, strain, and recovery - even if no data
  const hasData = sleep || recovery || strain || heartRate || temperature || waterIntake || stress;
  const showMainMetrics = !isLoading && !error;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-slate-800/50 shadow-2xl">
        <DialogHeader className="pb-6 border-b border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                <AvatarImage src={userAvatar || undefined} alt={userName} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-bold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-3xl font-bold text-white mb-1">
                  {userName}&apos;s Health Profile
                </DialogTitle>
                {timestamp && (
                  <p className="text-sm text-slate-400 font-medium">
                    Last updated: {format(new Date(timestamp), 'MMM d, yyyy h:mm a')}
                  </p>
                )}
              </div>
            </div>
           
          </div>
        </DialogHeader>

        <div className="py-8">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-16 w-16 text-orange-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Unable to Load Health Data
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                {error.message || 'Failed to fetch health data. Please try again later.'}
              </p>
            </div>
          )}

          {showMainMetrics && hasData && (
            <div className="space-y-10">
              {/* Main Metrics Grid - WHOOP Style - Only show when data exists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
                {/* Sleep */}
                {sleep && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={sleep.score || 0}
                      max={100}
                      label="SLEEP"
                      unit="%"
                      icon={Moon}
                      color="#3B82F6"
                    />
                    <div className="mt-4 text-center space-y-1">
                      <div className="text-sm text-slate-400">
                        {Math.floor((sleep.duration_minutes || 0) / 60)}h {(sleep.duration_minutes || 0) % 60}m
                      </div>
                      <div className="text-xs text-slate-500">
                        {sleep.efficiency?.toFixed(0)}% efficiency
                      </div>
                    </div>
                  </div>
                )}

                {/* Recovery */}
                {recovery && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={recovery.score || 0}
                      max={100}
                      label="RECOVERY"
                      unit="%"
                      icon={Zap}
                      color="#10B981"
                    />
                    <div className="mt-4 text-center space-y-1">
                      <div className="text-sm text-slate-400">
                        HRV: {recovery.hrv?.toFixed(0)} ms
                      </div>
                      <div className="text-xs text-slate-500">
                        RHR: {recovery.rhr} bpm
                      </div>
                    </div>
                  </div>
                )}

                {/* Strain */}
                {strain && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={strain.score || 0}
                      max={21}
                      label="STRAIN"
                      icon={Activity}
                      color="#A855F7"
                    />
                    <div className="mt-4 text-center space-y-1">
                      <div className="text-sm text-slate-400">
                        Normalized: {strain.normalized?.toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Health Score */}
                {healthScore > 0 && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={healthScore}
                      max={100}
                      label="HEALTH SCORE"
                      unit="%"
                      icon={Gauge}
                      color="#F59E0B"
                    />
                    <div className="mt-4 text-center space-y-1">
                      <div className="text-sm text-slate-400">
                        {healthScore >= 75 ? 'Excellent' : healthScore >= 50 ? 'Good' : healthScore >= 25 ? 'Fair' : 'Needs Attention'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stress */}
                {stress && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={stress.level || 0}
                      max={100}
                      label="STRESS"
                      unit="%"
                      icon={AlertTriangle}
                      color={stress.level >= 75 ? '#EF4444' : stress.level >= 50 ? '#F59E0B' : '#10B981'}
                    />
                    <div className="mt-4 text-center">
                      <div className="text-xs text-slate-500">
                        {stress.level >= 75 ? 'High' : stress.level >= 50 ? 'Moderate' : 'Low'} stress level
                      </div>
                    </div>
                  </div>
                )}

                {/* Water Intake */}
                {waterIntake && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={waterIntake.percentage || 0}
                      max={100}
                      label="WATER"
                      unit="%"
                      icon={Droplet}
                      color="#06B6D4"
                    />
                    <div className="mt-4 text-center space-y-1">
                      <div className="text-sm text-slate-400">
                        {formatWaterIntake(waterIntake.mlConsumed || 0)} / {formatWaterIntake(waterIntake.targetMl || 2000)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {waterIntake.percentage || 0}% of daily goal
                      </div>
                    </div>
                  </div>
                )}

                {/* Heart Rate */}
                {heartRate && (heartRate.resting || heartRate.avg) && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={heartRate.resting || heartRate.avg || 0}
                      max={heartRate.max || 200}
                      label="HEART RATE"
                      unit="bpm"
                      icon={Heart}
                      color="#EF4444"
                    />
                    <div className="mt-4 text-center space-y-1">
                      {heartRate.avg && (
                        <div className="text-sm text-slate-400">
                          Avg: {heartRate.avg} bpm
                        </div>
                      )}
                      {heartRate.max && (
                        <div className="text-xs text-slate-500">
                          Max: {heartRate.max} bpm
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Temperature */}
                {temperature && (
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={temperature}
                      max={40}
                      label="TEMPERATURE"
                      unit="°C"
                      icon={Thermometer}
                      color={temperature >= 37.5 ? '#EF4444' : temperature >= 36.5 ? '#F59E0B' : '#3B82F6'}
                    />
                    <div className="mt-4 text-center">
                      <div className="text-xs text-slate-500">
                        {temperature >= 37.5 ? 'Elevated' : temperature >= 36.5 ? 'Normal' : 'Low'} body temp
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Details Section */}
              {(sleep || recovery || heartRate || waterIntake || healthScore > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-slate-800/50">
                  {/* Health Score Breakdown */}
                  {healthScore > 0 && (
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50 hover:border-amber-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <Gauge className="w-5 h-5 text-amber-400" />
                        <h3 className="font-semibold text-white text-sm">Health Score</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Overall</span>
                          <span className="font-medium text-white">{healthScore}%</span>
                        </div>
                        {recovery?.score && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Recovery</span>
                            <span className="font-medium text-white">{recovery.score.toFixed(0)}%</span>
                          </div>
                        )}
                        {sleep?.score && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Sleep</span>
                            <span className="font-medium text-white">{sleep.score.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sleep && (
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50 hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <Moon className="w-5 h-5 text-blue-400" />
                        <h3 className="font-semibold text-white text-sm">Sleep Details</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Duration</span>
                          <span className="font-medium text-white">
                            {Math.floor((sleep.duration_minutes || 0) / 60)}h{' '}
                            {(sleep.duration_minutes || 0) % 60}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Efficiency</span>
                          <span className="font-medium text-white">
                            {sleep.efficiency?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Quality</span>
                          <span className="font-medium text-white">
                            {sleep.score?.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {recovery && (
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50 hover:border-emerald-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-semibold text-white text-sm">Recovery Details</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Score</span>
                          <span className="font-medium text-white">
                            {recovery.score?.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">HRV</span>
                          <span className="font-medium text-white">
                            {recovery.hrv?.toFixed(0)} ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">RHR</span>
                          <span className="font-medium text-white">
                            {recovery.rhr} bpm
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {heartRate && (
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50 hover:border-red-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <Heart className="w-5 h-5 text-red-400" />
                        <h3 className="font-semibold text-white text-sm">Heart Rate</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        {heartRate.resting && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Resting</span>
                            <span className="font-medium text-white">
                              {heartRate.resting} bpm
                            </span>
                          </div>
                        )}
                        {heartRate.avg && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Average</span>
                            <span className="font-medium text-white">
                              {heartRate.avg} bpm
                            </span>
                          </div>
                        )}
                        {heartRate.max && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Max</span>
                            <span className="font-medium text-white">
                              {heartRate.max} bpm
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {waterIntake && (
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-xl p-4 border border-slate-800/50 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <Droplet className="w-5 h-5 text-cyan-400" />
                        <h3 className="font-semibold text-white text-sm">Water Intake</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Consumed</span>
                          <span className="font-medium text-white">
                            {formatWaterIntake(waterIntake.mlConsumed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Target</span>
                          <span className="font-medium text-white">
                            {formatWaterIntake(waterIntake.targetMl || 2000)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Progress</span>
                          <span className="font-medium text-white">
                            {waterIntake.percentage || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showMainMetrics && !hasData && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Health Data Available</h3>
              <p className="text-slate-400 text-sm max-w-md">
                {healthData?._meta?.hasIntegration
                  ? healthData._meta.hasAnyData
                    ? 'No recent data available. Data may still be syncing.'
                    : 'WHOOP is connected but no data has been synced yet. Please wait for the initial sync to complete or trigger a manual sync.'
                  : 'This user has not connected a health device or synced any health data yet.'}
              </p>
            </div>
          )}

          {/* Achievements Section */}
          <UserAchievementsSection userId={userId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// User Achievements Section Component
function UserAchievementsSection({ userId }: { userId: string }) {
  const [achievements, setAchievements] = useState<UserAchievements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setLoading(true);
        const res = await api.get<UserAchievements>(`/achievements/user/${userId}`);
        if (res.success && res.data) {
          setAchievements(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch user achievements:', err);
        setError('Failed to load achievements');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchAchievements();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-8 pt-8 border-t border-slate-800/50">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  if (error || !achievements) {
    return null;
  }

  const levelName = achievements.level < 5 ? "Beginner" : achievements.level < 10 ? "Explorer" : achievements.level < 20 ? "Achiever" : achievements.level < 50 ? "Champion" : "Legend";
  const rarityColors: Record<string, string> = {
    common: "from-slate-400 to-slate-500",
    rare: "from-blue-400 to-cyan-500",
    epic: "from-purple-400 to-pink-500",
    legendary: "from-amber-400 to-orange-500",
  };

  return (
    <div className="mt-8 pt-8 border-t border-slate-800/50">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-white text-lg">Achievements</h3>
      </div>

      {/* Level & Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-300/80">Level</p>
              <p className="text-lg font-bold text-white">{achievements.level}</p>
              <p className="text-xs text-amber-400/70">{levelName}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total XP</p>
              <p className="text-lg font-bold text-white">{achievements.totalXP.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress to Next Level */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Progress to Level {achievements.level + 1}</span>
          <span className="text-amber-400 font-medium">
            {achievements.xpProgress}/{achievements.xpNeeded} XP
          </span>
        </div>
        <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${achievements.xpProgressPercentage}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-3 rounded-lg bg-slate-900/30 border border-slate-800/50">
          <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{achievements.currentStreak}</p>
          <p className="text-xs text-slate-400">Streak</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-slate-900/30 border border-slate-800/50">
          <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{achievements.totalUnlocked}</p>
          <p className="text-xs text-slate-400">Unlocked</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-slate-900/30 border border-slate-800/50">
          <Star className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{achievements.totalUnlocked}/{achievements.totalAchievements}</p>
          <p className="text-xs text-slate-400">Total</p>
        </div>
      </div>

      {/* Unlocked Achievements */}
      {achievements.unlockedAchievements.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Recent Achievements</h4>
          <div className="grid grid-cols-2 gap-3">
            {achievements.unlockedAchievements.slice(0, 6).map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "p-3 rounded-lg border backdrop-blur-sm",
                  `bg-gradient-to-br ${rarityColors[achievement.rarity] || 'from-slate-500/20 to-slate-600/20'}`,
                  "border-white/10"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{achievement.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{achievement.title}</p>
                    <p className="text-xs text-slate-300/70 truncate">{achievement.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    achievement.rarity === 'common' ? 'bg-slate-500/20 text-slate-300' :
                    achievement.rarity === 'rare' ? 'bg-blue-500/20 text-blue-300' :
                    achievement.rarity === 'epic' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-amber-500/20 text-amber-300'
                  )}>
                    {achievement.rarity}
                  </span>
                  <span className="text-xs text-amber-400 font-medium">+{achievement.xpReward} XP</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
