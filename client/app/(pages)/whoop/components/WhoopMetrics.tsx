'use client';

import { useFetch } from '@/hooks/use-fetch';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useEffect } from 'react';
import { Heart, Moon, Activity, Loader2, AlertCircle, RefreshCw, Download, TrendingUp, Thermometer, Droplet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function WhoopMetrics() {
  const { data, isLoading, error, refetch, reset } = useFetch<{
    currentRecovery: {
      score: number;
      hrv: number;
      rhr: number;
      spo2?: number;
      skinTemp?: number;
      timestamp: string;
    } | null;
    currentSleep: {
      duration: number;
      quality: number;
      efficiency: number;
      timestamp: string;
    } | null;
    todayStrain: {
      score: number;
      normalized: number;
      avgHeartRate?: number;
      maxHeartRate?: number;
      calories?: number;
      timestamp: string;
    } | null;
  }>('/whoop/analytics/overview', {
    immediate: true,
  });

  // Listen for refresh/connection events from parent
  useEffect(() => {
    const handleRefresh = () => { reset(); refetch(); };
    window.addEventListener('whoop-refresh-requested', handleRefresh);
    window.addEventListener('whoop-connected', handleRefresh);
    return () => {
      window.removeEventListener('whoop-refresh-requested', handleRefresh);
      window.removeEventListener('whoop-connected', handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { mutate: triggerSync, isLoading: isSyncing } = useApiMutation({
    onSuccess: () => {
      toast.success('Sync started! Data will appear shortly...');
      // Refetch after a short delay to get new data
      setTimeout(() => {
        refetch();
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync data');
    },
  });

  const handleRetry = async () => {
    try {
      await refetch();
      toast.success('Refreshing metrics...');
    } catch (_err) {
      toast.error('Failed to refresh metrics');
    }
  };

  const handleSync = () => {
    triggerSync('/integrations/whoop/sync', {});
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-12 h-12 rounded-xl bg-slate-700/50" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2 bg-slate-700/50" />
                  <Skeleton className="h-8 w-16 bg-slate-700/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-slate-700/50" />
                <Skeleton className="h-3 w-3/4 bg-slate-700/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            <div>
              <p className="text-[13px] sm:text-[14px] text-red-400 font-medium">Failed to load metrics</p>
              <p className="text-[13px] sm:text-[14px] text-red-300/70 mt-1">
                {error.message || 'Unable to fetch WHOOP data. Please check your connection and try again.'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Check if data exists but is empty
  if (!data) {
    return (
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          <div className="flex-1">
            <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No data available</p>
            <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
              Unable to load WHOOP metrics. Please try refreshing.
            </p>
          </div>
          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  const recovery = data.currentRecovery;
  const sleep = data.currentSleep;
  const strain = data.todayStrain;

  // Check if all metrics are null (no data available)
  const hasNoData = !recovery && !sleep && !strain;

  if (hasNoData) {
    return (
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <div className="flex-1">
              <p className="text-[13px] sm:text-[14px] text-blue-400 font-medium">No data available</p>
              <p className="text-[13px] sm:text-[14px] text-blue-300/70 mt-1">
                WHOOP data hasn&apos;t been synced yet. Your device is connected, but no health data has been received. This usually means:
                <br />• Data sync may take a few minutes after connecting
                <br />• Make sure your WHOOP device is actively tracking and syncing
                <br />• Try refreshing or check back later
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              variant="outline"
              size="sm"
              disabled={isSyncing}
              className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </Button>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const MetricCard = ({ 
    icon: Icon, 
    title, 
    value, 
    details, 
    gradient, 
    iconColor,
    isEmpty = false 
  }: {
    icon: typeof Heart;
    title: string;
    value: string | number;
    details?: React.ReactNode;
    gradient: string;
    iconColor: string;
    isEmpty?: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} backdrop-blur-sm border border-white/10 p-4 sm:p-6 transition-all duration-300 ${
        isEmpty ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-[14px] font-medium text-white/90">{title}</p>
          <p className="text-[18px] sm:text-2xl font-bold text-white mt-0.5 sm:mt-1 truncate">
            {isEmpty ? '--' : value}
          </p>
        </div>
      </div>
      {details && (
        <div className="space-y-1 sm:space-y-1.5 text-[13px] text-white/80 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
          {details}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Recovery */}
      <MetricCard
        icon={Heart}
        title="Recovery"
        value={recovery?.score ?? '--'}
        gradient="from-red-500/20 via-rose-500/20 to-red-500/20"
        iconColor="text-red-400"
        isEmpty={!recovery}
        details={recovery ? (
          <>
            <p className="flex items-center justify-between">
              <span className="text-white/70">HRV:</span>
              <span className="font-semibold text-white">{recovery.hrv.toFixed(2)}ms</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-white/70">RHR:</span>
              <span className="font-semibold text-white">{recovery.rhr} bpm</span>
            </p>
            {recovery.spo2 && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">SPO2:</span>
                <span className="font-semibold text-white">{recovery.spo2}%</span>
              </p>
            )}
            {recovery.skinTemp && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Temp:</span>
                <span className="font-semibold text-white">{recovery.skinTemp.toFixed(1)}°C</span>
              </p>
            )}
            <p className="text-white/50 text-[10px] mt-2 pt-2 border-t border-white/5">
              {formatDate(recovery.timestamp)}
            </p>
          </>
        ) : (
          <p className="text-white/50">No recovery data</p>
        )}
      />

      {/* Sleep */}
      <MetricCard
        icon={Moon}
        title="Sleep"
        value={sleep ? `${Math.round(sleep.duration / 60)}h` : '--'}
        gradient="from-blue-500/20 via-cyan-500/20 to-blue-500/20"
        iconColor="text-blue-400"
        isEmpty={!sleep}
        details={sleep ? (
          <>
            <p className="flex items-center justify-between">
              <span className="text-white/70">Quality:</span>
              <span className="font-semibold text-white">{sleep.quality}%</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-white/70">Efficiency:</span>
              <span className="font-semibold text-white">{sleep.efficiency.toFixed(1)}%</span>
            </p>
            <p className="text-white/50 text-[10px] mt-2 pt-2 border-t border-white/5">
              {formatDate(sleep.timestamp)}
            </p>
          </>
        ) : (
          <p className="text-white/50">No sleep data</p>
        )}
      />

      {/* Strain */}
      <MetricCard
        icon={Activity}
        title="Strain"
        value={strain?.score ?? '--'}
        gradient="from-purple-500/20 via-violet-500/20 to-purple-500/20"
        iconColor="text-purple-400"
        isEmpty={!strain}
        details={strain ? (
          <>
            <p className="flex items-center justify-between">
              <span className="text-white/70">Normalized:</span>
              <span className="font-semibold text-white">{strain.normalized.toFixed(0)}%</span>
            </p>
            {strain.avgHeartRate && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Avg HR:</span>
                <span className="font-semibold text-white">{strain.avgHeartRate} bpm</span>
              </p>
            )}
            {strain.maxHeartRate && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Max HR:</span>
                <span className="font-semibold text-white">{strain.maxHeartRate} bpm</span>
              </p>
            )}
            {strain.calories && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Calories:</span>
                <span className="font-semibold text-white">{Math.round(strain.calories)}</span>
              </p>
            )}
            <p className="text-white/50 text-[10px] mt-2 pt-2 border-t border-white/5">
              {formatDate(strain.timestamp)}
            </p>
          </>
        ) : (
          <p className="text-white/50">No strain data</p>
        )}
      />

      {/* Heart Rate */}
      <MetricCard
        icon={Heart}
        title="Heart Rate"
        value={strain?.avgHeartRate || recovery?.rhr ? `${strain?.avgHeartRate || recovery?.rhr} bpm` : '--'}
        gradient="from-pink-500/20 via-rose-500/20 to-pink-500/20"
        iconColor="text-pink-400"
        isEmpty={!strain?.avgHeartRate && !recovery?.rhr}
        details={(strain?.avgHeartRate || recovery?.rhr) ? (
          <>
            {strain?.avgHeartRate && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Average:</span>
                <span className="font-semibold text-white">{strain.avgHeartRate} bpm</span>
              </p>
            )}
            {strain?.maxHeartRate && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Maximum:</span>
                <span className="font-semibold text-white">{strain.maxHeartRate} bpm</span>
              </p>
            )}
            {recovery?.rhr && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">Resting:</span>
                <span className="font-semibold text-white">{recovery.rhr} bpm</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-white/50">No heart rate data</p>
        )}
      />

      {/* HRV */}
      <MetricCard
        icon={TrendingUp}
        title="HRV"
        value={recovery?.hrv ? `${recovery.hrv.toFixed(2)}ms` : '--'}
        gradient="from-emerald-500/20 via-green-500/20 to-emerald-500/20"
        iconColor="text-emerald-400"
        isEmpty={!recovery?.hrv}
        details={recovery?.hrv ? (
          <>
            <p className="flex items-center justify-between">
              <span className="text-white/70">RMSSD:</span>
              <span className="font-semibold text-white">{recovery.hrv.toFixed(2)}ms</span>
            </p>
            {recovery.rhr && (
              <p className="flex items-center justify-between">
                <span className="text-white/70">RHR:</span>
                <span className="font-semibold text-white">{recovery.rhr} bpm</span>
              </p>
            )}
            <p className="text-white/50 text-[10px] mt-2 pt-2 border-t border-white/5">
              {formatDate(recovery.timestamp)}
            </p>
          </>
        ) : (
          <p className="text-white/50">No HRV data</p>
        )}
      />

      {/* Temperature */}
      <MetricCard
        icon={Thermometer}
        title="Temperature"
        value={recovery?.skinTemp ? `${recovery.skinTemp.toFixed(1)}°C` : '--'}
        gradient="from-orange-500/20 via-amber-500/20 to-orange-500/20"
        iconColor="text-orange-400"
        isEmpty={!recovery?.skinTemp}
        details={recovery?.skinTemp ? (
          <>
            <p className="flex items-center justify-between">
              <span className="text-white/70">Skin Temp:</span>
              <span className="font-semibold text-white">{recovery.skinTemp.toFixed(1)}°C</span>
            </p>
            <p className="text-white/50 text-[10px] mt-2 pt-2 border-t border-white/5">
              {formatDate(recovery.timestamp)}
            </p>
          </>
        ) : (
          <p className="text-white/50">No temperature data</p>
        )}
      />

      {/* SPO2 */}
      <MetricCard
        icon={Droplet}
        title="SPO2"
        value={recovery?.spo2 ? `${recovery.spo2}%` : '--'}
        gradient="from-cyan-500/20 via-blue-500/20 to-cyan-500/20"
        iconColor="text-cyan-400"
        isEmpty={!recovery?.spo2}
        details={recovery?.spo2 ? (
          <>
            <p className="flex items-center justify-between">
              <span className="text-white/70">Oxygen:</span>
              <span className="font-semibold text-white">{recovery.spo2}%</span>
            </p>
            <p className="text-white/50 text-[10px] mt-2 pt-2 border-t border-white/5">
              {formatDate(recovery.timestamp)}
            </p>
          </>
        ) : (
          <p className="text-white/50">No SPO2 data</p>
        )}
      />
    </div>
  );
}

