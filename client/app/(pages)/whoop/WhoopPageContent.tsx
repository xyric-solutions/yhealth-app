'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { WhoopOverview } from './components/WhoopOverview';
import { RecoveryChart } from './components/RecoveryChart';
import { SleepStagesChart } from './components/SleepStagesChart';
import { StrainChart } from './components/StrainChart';
import { CycleAnalysis } from './components/CycleAnalysis';
import { RecoveriesTable } from './components/RecoveriesTable';
import { WhoopMetrics } from './components/WhoopMetrics';
import { StressMonitor } from './components/StressMonitor';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Activity, Heart, Moon, TrendingUp, CheckCircle2, XCircle, AlertCircle, Loader2, Settings, Clock, Link2, Calendar, Brain, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { getSocket } from '@/lib/socket-client';
import { DashboardUnderlineTabs } from '@/app/(pages)/dashboard/components/DashboardUnderlineTabs';

interface WhoopStatus {
  isConnected: boolean;
  hasCredentials: boolean;
  status: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  webhookRegistered: boolean;
  initialSyncComplete: boolean;
  provider: string;
  email?: string;
  whoopUserId?: number;
  firstName?: string;
  lastName?: string;
}

export default function WhoopPageContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);
  const router = useRouter();
  const isConnectedRef = useRef<boolean>(false);

  const { data: statusData, isLoading: isLoadingStatus, error: statusError, refetch: refetchStatus } = useFetch<WhoopStatus>(
    '/integrations/whoop/status',
    { immediate: true }
  );

  // Hide initial skeleton once status is loaded
  useEffect(() => {
    if (!isLoadingStatus && statusData) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowInitialSkeleton(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingStatus, statusData]);

  // Refetch status when user returns to tab (visibility change)
  // Only the parent handles visibility — child components do NOT add their own listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchStatus();
        // Notify children to refetch via single event
        window.dispatchEvent(new CustomEvent('whoop-refresh-requested'));
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for real-time sync events (auto-sync at 8am or manual refresh)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSynced = () => {
      refetchStatus();
      window.dispatchEvent(new CustomEvent('whoop-refresh-requested'));
      toast.success('WHOOP data synced automatically');
    };

    socket.on('whoop-data-synced', handleSynced);
    return () => { socket.off('whoop-data-synced', handleSynced); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stabilize isConnected value to prevent components from unmounting
  // Once connected, keep the ref true even if status temporarily changes
  useEffect(() => {
    if (statusData?.isConnected) {
      isConnectedRef.current = true;
      // Dispatch event to notify child components that connection is established
      window.dispatchEvent(new CustomEvent('whoop-connected'));
    }
    // Don't set to false when disconnected - keep showing data to prevent flash
    // Only set to false if explicitly disconnected AND we have confirmed status
  }, [statusData?.isConnected]);

  // No mount events needed — child components use `immediate: true` in useFetch
  // Tab changes unmount/remount child components via AnimatePresence, which triggers useFetch automatically

  // Handle refresh - sync data from WHOOP and refetch
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);

      // Trigger sync from WHOOP API
      const syncResponse = await api.post('/integrations/whoop/sync', {});

      if (syncResponse.success) {
        toast.success('Syncing latest data from WHOOP...');

        // Refetch status
        await refetchStatus();

        // Wait for sync to process, then notify children to refetch
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('whoop-refresh-requested'));
          toast.success('Data refreshed successfully');
        }, 2000);
      } else {
        throw new Error('Failed to trigger sync');
      }
    } catch (error) {
      console.error('[WHOOP Page] Failed to refresh data:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to refresh data. Please try again.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle WHOOP OAuth connection
  const handleConnectWhoop = async () => {
    try {
      setIsConnecting(true);

      console.log('[WHOOP Page] Initiating OAuth connection...');

      const response = await api.post<{
        authUrl: string;
        state: string;
      }>('/integrations/oauth/initiate', {
        provider: 'whoop',
      });

      if (!response.success || !response.data?.authUrl) {
        throw new Error('Failed to get authorization URL');
      }

      console.log('[WHOOP Page] Redirecting to WHOOP authorization page...', {
        hasAuthUrl: !!response.data.authUrl,
      });

      // Redirect user to WHOOP authorization page
      window.location.href = response.data.authUrl;

      // Note: User will be redirected back to /auth/whoop/callback after authorization
    } catch (error) {
      console.error('[WHOOP Page] Failed to initiate WHOOP connection:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to connect WHOOP. Please ensure WHOOP credentials are configured in settings.'
      );
      setIsConnecting(false);
    }
  };

  return (
    <DashboardLayout activeTab="whoop">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-4 sm:mb-8 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[18px] sm:text-[20px] font-bold text-white mb-1 sm:mb-2">
                <span className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  WHOOP Analytics
                </span>
              </h1>
              <p className="text-slate-400 text-[13px] sm:text-[14px]">
                Comprehensive recovery, sleep, and strain insights
              </p>
            </div>
            {/* Refresh Button - Show when connected */}
            {(statusData?.isConnected || isConnectedRef.current) && (
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoadingStatus}
                variant="outline"
                size="sm"
                className="bg-purple-500/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Data
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Connection Status Banner */}
          {isLoadingStatus ? (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-purple-400 mr-2" />
              <span className="text-slate-400 text-[13px] sm:text-[14px]">Loading connection status...</span>
            </div>
          ) : statusError ? (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-red-400 font-medium text-[14px]">Failed to load connection status</p>
                  <p className="text-[13px] text-red-300/70">{statusError.message || 'Unknown error'}</p>
                </div>
              </div>
              <Button
                onClick={() => refetchStatus()}
                variant="outline"
                size="sm"
                className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 text-[13px]"
              >
                Retry
              </Button>
            </div>
          ) : statusData && !statusData.isConnected && !statusData.hasCredentials ? (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-yellow-400 font-medium text-[14px]">WHOOP OAuth not configured</p>
                  <p className="text-[13px] text-yellow-300/70">Please add your WHOOP Client ID and Client Secret in settings to connect.</p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/settings?tab=integrations')}
                className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 text-[13px] sm:text-[14px]"
              >
                <Settings className="w-4 h-4 mr-2" />
                View Settings
              </Button>
            </div>
          ) : statusData && !statusData.isConnected ? (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 shrink-0" />
                <div>
                  <p className="text-orange-400 font-medium text-[14px]">WHOOP disconnected</p>
                  <p className="text-[13px] text-orange-300/70">
                    Status: {statusData.status === 'pending' ? 'Pending connection' : 'Disconnected'}
                    {statusData.lastSyncAt && (
                      <span className="ml-2">
                        • Last sync: {new Date(statusData.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConnectWhoop}
                  disabled={isConnecting || !statusData.hasCredentials}
                  variant="outline"
                  size="sm"
                  className="bg-purple-500/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-[13px]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => router.push('/settings?tab=integrations')}
                  variant="outline"
                  size="sm"
                  className="bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 text-[13px]"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </div>
            </div>
          ) : statusData && statusData.isConnected ? (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-green-400 font-medium text-[14px]">WHOOP connected</p>
                  <div className="flex items-center gap-2 sm:gap-4 text-[13px] text-green-300/70 mt-1 flex-wrap">
                    {statusData.email && (
                      <span className="flex items-center gap-1 truncate">
                        <span className="text-green-400">Email:</span> {statusData.email}
                      </span>
                    )}
                    {statusData.connectedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Connected: {new Date(statusData.connectedAt).toLocaleDateString()}
                      </span>
                    )}
                    {statusData.lastSyncAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last sync: {new Date(statusData.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                    {statusData.webhookRegistered && (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Webhook active
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConnectWhoop}
                  disabled={isConnecting}
                  variant="outline"
                  size="sm"
                  className="bg-purple-500/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-[13px]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Reconnecting...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Reconnect WHOOP</span>
                      <span className="sm:hidden">Reconnect</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => router.push('/settings?tab=integrations')}
                  variant="outline"
                  size="sm"
                  className="bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 text-[13px]"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </div>
            </div>
          ) : null}

          {/* Loading Skeleton when status is loading or initial load */}
          {(isLoadingStatus || showInitialSkeleton) ? (
            <div className="space-y-8">
              {/* Metrics Skeleton */}
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

              <div className="flex gap-3 border-b border-white/10 pb-3 overflow-x-auto">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-9 w-28 rounded-md bg-slate-700/50 flex-shrink-0" />
                ))}
              </div>

              {/* Tab Content Skeleton */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-6">
                      <Skeleton className="h-5 w-32 mb-4 bg-slate-700/50" />
                      <Skeleton className="h-64 w-full rounded-lg bg-slate-700/50" />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 p-6">
                  <Skeleton className="h-6 w-48 mb-4 bg-slate-700/50" />
                  <Skeleton className="h-96 w-full rounded-lg bg-slate-700/50" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Current Metrics - Always show (has own loading state) */}
              <WhoopMetrics />

              {/* Tabs - Always show (components have own loading states) */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 sm:mt-8">
            <div className="mb-4 sm:mb-8">
              <DashboardUnderlineTabs
                layoutId="whoopSubTabUnderline"
                activeId={activeTab}
                onTabChange={setActiveTab}
                tabs={[
                  { id: 'overview', label: 'Overview', icon: TrendingUp },
                  { id: 'recovery', label: 'Recovery', icon: Heart },
                  { id: 'sleep', label: 'Sleep', icon: Moon },
                  { id: 'strain', label: 'Strain', icon: Activity },
                  { id: 'stress', label: 'Stress', icon: Brain },
                  { id: 'cycles', label: 'Cycles', icon: Calendar },
                ]}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {activeTab === 'overview' && (
                  <TabsContent value="overview" className="mt-0">
                    <WhoopOverview />
                  </TabsContent>
                )}
                {activeTab === 'recoveries' && (
                  <TabsContent value="recoveries" className="mt-0">
                    <RecoveriesTable />
                  </TabsContent>
                )}
                {activeTab === 'recovery' && (
                  <TabsContent value="recovery" className="mt-0">
                    <RecoveryChart />
                  </TabsContent>
                )}
                {activeTab === 'sleep' && (
                  <TabsContent value="sleep" className="mt-0">
                    <SleepStagesChart />
                  </TabsContent>
                )}
                {activeTab === 'strain' && (
                  <TabsContent value="strain" className="mt-0">
                    <StrainChart />
                  </TabsContent>
                )}
                {activeTab === 'stress' && (
                  <TabsContent value="stress" className="mt-0">
                    <StressMonitor />
                  </TabsContent>
                )}
                {activeTab === 'cycles' && (
                  <TabsContent value="cycles" className="mt-0">
                    <CycleAnalysis />
                  </TabsContent>
                )}
              </motion.div>
            </AnimatePresence>
          </Tabs>
            </>
          )}

          {/* Empty state when not connected - show connect CTA and preview */}
          {!isLoadingStatus && statusData && !statusData.isConnected && !isConnectedRef.current && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-4 sm:mt-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-8 md:p-12 text-center"
            >
              <div className="max-w-lg mx-auto">
                <Heart className="w-12 h-12 sm:w-16 sm:h-16 text-purple-400/60 mx-auto mb-3 sm:mb-4" />
                <h2 className="text-[16px] sm:text-[18px] font-semibold text-white mb-2">Connect WHOOP to see your analytics</h2>
                <p className="text-slate-400 text-[13px] sm:text-[14px] mb-4 sm:mb-6">
                  Once connected, you&apos;ll see recovery scores, sleep analysis, strain patterns, and stress insights from your WHOOP device.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {statusData.hasCredentials ? (
                    <Button
                      onClick={handleConnectWhoop}
                      disabled={isConnecting}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4 mr-2" />
                          Connect WHOOP
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => router.push('/settings?tab=integrations')}
                      variant="outline"
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure in Settings
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
      </div>
    </DashboardLayout>
  );
}
