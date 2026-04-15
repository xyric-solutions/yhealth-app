'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LeaderboardView } from './components/LeaderboardView';
import { ErrorBoundary, ErrorFallback, CompetitionsSection } from '@/components/features/competitions';
import { CompetitionDetailView } from '@/app/(pages)/competitions/components/CompetitionDetailView';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { DailyScoreCard } from './components/DailyScoreCard';
import { LeaderboardFilters } from './components/LeaderboardFilters';
import { AroundMeView } from './components/AroundMeView';
import { useFetch } from '@/hooks/use-fetch';
import { useLeaderboardSocket } from '@/hooks/use-leaderboard-socket';
import type { BoardType, TimeFilter, DailyScore, Competition, CompetitionEntry, LeaderboardResponse } from '@/src/shared/services/leaderboard.service';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { Trophy, Users, Swords, Crown, Hash, Flame, Globe, X, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Floating ambient particles */
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  duration: 8 + Math.random() * 12,
  delay: Math.random() * 6,
}));

type ViewType = 'leaderboard' | 'around-me' | 'competitions' | 'history';

const VIEW_TABS = [
  { id: 'leaderboard' as ViewType, label: 'Leaderboard', icon: Trophy, shortLabel: 'Board' },
  { id: 'around-me' as ViewType, label: 'Around Me', icon: Users, shortLabel: 'Me' },
  { id: 'competitions' as ViewType, label: 'Competitions', icon: Swords, shortLabel: 'Comp' },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
} as const;

const viewTransitionInitial = { opacity: 0, y: 24, scale: 0.98 };
const viewTransitionAnimate = { opacity: 1, y: 0, scale: 1 };
const viewTransitionExit = { opacity: 0, y: -16, scale: 0.98 };
const viewTransitionDuration = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const };

export default function LeaderboardPageContent() {
  const { user } = useAuth();
  const [boardType, setBoardType] = useState<BoardType>('global');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('leaderboard');
  const [aroundMeData, setAroundMeData] = useState<LeaderboardResponse | null>(null);
  const [optimisticJoins, setOptimisticJoins] = useState<Set<string>>(new Set());
  const [optimisticLeaves, setOptimisticLeaves] = useState<Set<string>>(new Set());
  const [detailCompetition, setDetailCompetition] = useState<Competition | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cursor glow tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!cursorVisible) setCursorVisible(true);
  }, [cursorVisible]);

  const handleMouseLeave = useCallback(() => setCursorVisible(false), []);

  // Fetch user's daily score
  const {
    data: dailyScore,
    isLoading: scoreLoading,
    error: _scoreError,
    refetch: refetchScore,
  } = useFetch<DailyScore>(
    `/daily-score?date=${selectedDate}`,
    { immediate: !!user?.id, deps: [user?.id, selectedDate] },
  );

  // Fetch previous day's score for comparison
  const previousDate = useMemo(() => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }, [selectedDate]);
  
  const {
    data: previousScore,
  } = useFetch<DailyScore>(
    `/daily-score?date=${previousDate}`,
    { immediate: !!user?.id, deps: [user?.id, previousDate] },
  );

  // Fetch active competitions
  const {
    data: competitionsData,
    isLoading: _competitionsLoading,
    refetch: refetchCompetitions,
  } = useFetch<Competition[] | { competitions: Competition[] }>(
    '/competitions',
    { immediate: !!user?.id, deps: [user?.id] },
  );

  // Fetch around me data when on around-me view
  const {
    data: aroundMeFetched,
    isLoading: aroundMeLoading,
    refetch: refetchAroundMe,
  } = useFetch<LeaderboardResponse>(
    currentView === 'around-me'
      ? `/leaderboards/daily/around-me?date=${selectedDate}&type=${boardType}&range=50`
      : null,
    { immediate: !!user?.id && currentView === 'around-me', deps: [user?.id, currentView, selectedDate, boardType] },
  );

  useEffect(() => {
    if (aroundMeFetched) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAroundMeData(aroundMeFetched);
    }
  }, [aroundMeFetched]);

  // Real-time socket updates
  useLeaderboardSocket({
    userId: user?.id,
    enabled: !!user?.id,
    onScoreUpdate: () => {
      refetchScore();
    },
    onRankUpdate: () => {
      if (currentView === 'around-me') {
        refetchAroundMe();
      }
    },
  });

  // Normalize competitions data
  const competitions = useMemo(() => {
    const raw = Array.isArray(competitionsData)
      ? competitionsData
      : competitionsData?.competitions || [];
    return raw as (Competition & { is_joined?: boolean; participant_count?: number })[];
  }, [competitionsData]);

  const activeCompetitionCount = useMemo(() => competitions.length, [competitions]);

  // User's joined competition IDs (from API + optimistic updates)
  const userJoinedIds = useMemo(() => {
    const apiJoined = new Set(
      competitions.filter((c) => c.is_joined).map((c) => c.id)
    );
    optimisticJoins.forEach((id) => apiJoined.add(id));
    optimisticLeaves.forEach((id) => apiJoined.delete(id));
    return apiJoined;
  }, [competitions, optimisticJoins, optimisticLeaves]);

  // Clean up optimistic state once API confirms
  useEffect(() => {
    const apiIds = new Set(competitions.filter((c) => c.is_joined).map((c) => c.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticJoins((prev) => {
      const next = new Set(prev);
      prev.forEach((id) => { if (apiIds.has(id)) next.delete(id); });
      return next.size !== prev.size ? next : prev;
    });
    setOptimisticLeaves((prev) => {
      const next = new Set(prev);
      prev.forEach((id) => { if (!apiIds.has(id)) next.delete(id); });
      return next.size !== prev.size ? next : prev;
    });
  }, [competitions]);

  const isJoined = useCallback(
    (id: string) => userJoinedIds.has(id),
    [userJoinedIds]
  );

  const handleJoinCompetition = useCallback((competitionId: string) => {
    setOptimisticJoins((prev) => new Set(prev).add(competitionId));
    refetchCompetitions();
  }, [refetchCompetitions]);

  const handleLeaveCompetition = useCallback((competitionId: string) => {
    setOptimisticLeaves((prev) => new Set(prev).add(competitionId));
    refetchCompetitions();
  }, [refetchCompetitions]);

  const handleViewDetails = useCallback((competition: Competition) => {
    setDetailCompetition(competition);
    setDetailModalOpen(true);
  }, []);

  const handleViewLeaderboard = useCallback((competitionId: string) => {
    setSelectedCompetition(competitionId);
    setCurrentView('leaderboard');
  }, []);

  const handleClearCompetition = useCallback(() => {
    setSelectedCompetition(null);
  }, []);

  // Find name of selected competition for display
  const selectedCompetitionName = useMemo(() => {
    if (!selectedCompetition) return null;
    const comp = competitions.find((c) => c.id === selectedCompetition);
    return comp?.name ?? 'Competition';
  }, [selectedCompetition, competitions]);

  const buildUserEntry = useCallback(
    (competition: Competition): CompetitionEntry | undefined => {
      if (!isJoined(competition.id)) return undefined;
      return {
        id: '',
        competition_id: competition.id,
        user_id: user?.id || '',
        joined_at: '',
        status: 'active',
        current_rank: null,
        current_score: null,
      };
    },
    [isJoined, user?.id]
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="min-h-screen bg-gray-950 relative overflow-hidden"
        role="main"
        aria-label="Leaderboard page"
      >
        {/* Live region for rank updates */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {currentView === 'leaderboard' && 'Leaderboard view active'}
          {currentView === 'around-me' && 'Around me view active'}
          {currentView === 'competitions' && 'Competitions view active'}
        </div>

        {/* Cursor glow follower — absolute within container, no ref in render */}
        <div
          className="absolute pointer-events-none z-50 transition-opacity duration-200"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: 300,
            height: 300,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 40%, transparent 70%)',
            opacity: cursorVisible ? 1 : 0,
          }}
          aria-hidden="true"
        />

        {/* Floating particles */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-emerald-400/30"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                top: `${p.y}%`,
              }}
              animate={{
                y: [0, -40, 0],
                x: [0, 15, -10, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: p.delay,
              }}
            />
          ))}
        </div>

        {/* Global scanline overlay */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-40" aria-hidden="true">
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent"
            animate={{ top: ['-2%', '102%'] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* ---- Background layer ---- */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />

          {/* Gradient orbs - subtle and atmospheric */}
          <motion.div
            className="absolute -top-48 -left-48 w-150 h-150 rounded-full bg-emerald-500/7 blur-[120px]"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.07, 0.12, 0.07],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute -bottom-48 -right-48 w-125 h-125 rounded-full bg-purple-500/6 blur-[120px]"
            animate={{
              scale: [1.1, 1, 1.1],
              opacity: [0.06, 0.1, 0.06],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2,
            }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-100 h-100 rounded-full bg-blue-500/4 blur-[100px]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.04, 0.08, 0.04],
            }}
            transition={{
              duration: 14,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 4,
            }}
          />
        </div>

        {/* ---- Content ---- */}
        <div className="relative z-10 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full"
          >
            {/* ============================================ */}
            {/* Hero Header                                  */}
            {/* ============================================ */}
            <motion.header variants={itemVariants} className="mb-8 sm:mb-10">
              {/* Title row */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <motion.h1 
                      className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                        Leaderboard
                      </span>
                    </motion.h1>
                    <motion.div
                      animate={{ 
                        rotate: [0, -8, 8, -4, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        repeatDelay: 2,
                      }}
                      className="shrink-0"
                    >
                      <Crown className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                    </motion.div>
                  </div>
                  <motion.p 
                    className="text-sm sm:text-base lg:text-lg text-gray-400 max-w-2xl"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    {dailyScore?.rank?.global
                      ? `You're ranked #${dailyScore.rank.global} globally. Keep climbing! 🚀`
                      : 'Compete with the community and track your progress'}
                  </motion.p>
                </div>
              </div>

              {/* Stat pills */}
              {dailyScore && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="flex flex-wrap gap-2 sm:gap-3"
                >
                  {dailyScore.rank?.global != null && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/4 border border-white/8 text-xs sm:text-sm text-gray-300">
                      <Hash className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-gray-500">Rank</span>
                      <span className="font-semibold text-white tabular-nums">
                        #{dailyScore.rank.global}
                      </span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/4 border border-white/8 text-xs sm:text-sm text-gray-300">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-gray-500">Score</span>
                    <span className="font-semibold text-white tabular-nums">
                      {Number(dailyScore.total_score).toFixed(1)}
                    </span>
                  </div>
                  {aroundMeData?.pagination?.total != null && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/4 border border-white/8 text-xs sm:text-sm text-gray-300">
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-gray-500">Players</span>
                      <span className="font-semibold text-white tabular-nums">
                        {aroundMeData.pagination.total.toLocaleString()}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.header>

            {/* ============================================ */}
            {/* View Switcher Tabs - Enhanced Design         */}
            {/* ============================================ */}
            <motion.div variants={itemVariants} className="mb-8 w-full">
              <nav
                className="relative inline-flex p-1.5 rounded-2xl bg-gradient-to-br from-white/5 via-white/3 to-white/5 backdrop-blur-2xl border border-white/10 shadow-xl shadow-black/20 overflow-x-auto w-full sm:w-auto"
                role="tablist"
                aria-label="Leaderboard views"
              >
                {/* Animated background glow */}
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-pink-500/10 blur-xl"
                  animate={{
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {VIEW_TABS.map((view, index) => {
                  const Icon = view.icon;
                  const isActive = currentView === view.id;

                  return (
                    <motion.button
                      key={view.id}
                      onClick={() => setCurrentView(view.id)}
                      aria-label={`Switch to ${view.label} view`}
                      aria-selected={isActive}
                      role="tab"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        'relative px-5 sm:px-6 py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2.5 shrink-0 whitespace-nowrap',
                        'min-h-12',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
                        isActive
                          ? 'text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      )}
                    >
                      {/* Animated active indicator pill with glow */}
                      {isActive && (
                        <>
                          <motion.div
                            layoutId="activeTab"
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30"
                            transition={{
                              type: 'spring',
                              stiffness: 400,
                              damping: 30,
                            }}
                          />
                          {/* Glow effect */}
                          <motion.div
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/50 to-teal-400/50 blur-md"
                            animate={{
                              opacity: [0.5, 0.8, 0.5],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                        </>
                      )}
                      
                      <span className="relative z-10 flex items-center gap-2.5">
                        <motion.div
                          animate={isActive ? { 
                            rotate: [0, -10, 10, 0],
                            scale: [1, 1.1, 1]
                          } : {}}
                          transition={{
                            duration: 0.5,
                            repeat: isActive ? Infinity : 0,
                            repeatDelay: 2,
                          }}
                        >
                          <Icon className={cn(
                            'w-4 h-4 sm:w-5 sm:h-5 transition-colors',
                            isActive ? 'text-white' : 'text-gray-400'
                          )} />
                        </motion.div>
                        <span className="hidden sm:inline font-semibold">{view.label}</span>
                        <span className="sm:hidden font-semibold">{view.shortLabel}</span>
                        
                        {/* Competition count badge with animation */}
                        {view.id === 'competitions' && activeCompetitionCount > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.2 }}
                            className={cn(
                              'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums',
                              isActive
                                ? 'bg-white/30 text-white shadow-lg'
                                : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            )}
                          >
                            {activeCompetitionCount}
                          </motion.span>
                        )}
                      </span>
                    </motion.button>
                  );
                })}
              </nav>
            </motion.div>

            {/* ============================================ */}
            {/* Daily Score Card                              */}
            {/* ============================================ */}
            <AnimatePresence mode="wait">
              {currentView !== 'competitions' && dailyScore && (
                <motion.div
                  key="daily-score"
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.4, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="mb-6 w-full"
                >
                  <DailyScoreCard score={dailyScore} isLoading={scoreLoading} previousScore={previousScore || null} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============================================ */}
            {/* Filters                                      */}
            {/* ============================================ */}
            <AnimatePresence mode="wait">
              {currentView !== 'competitions' && (
                <motion.div
                  key="filters"
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="mb-6 w-full"
                >
                  <LeaderboardFilters
                    boardType={boardType}
                    timeFilter={timeFilter}
                    selectedDate={selectedDate}
                    onBoardTypeChange={setBoardType}
                    onTimeFilterChange={setTimeFilter}
                    onDateChange={setSelectedDate}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============================================ */}
            {/* Competition Indicator Banner                  */}
            {/* ============================================ */}
            <AnimatePresence mode="wait">
              {currentView === 'leaderboard' && selectedCompetition && selectedCompetitionName && (
                <motion.div
                  key="competition-banner"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4 w-full"
                >
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 backdrop-blur-sm">
                    <Trophy className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-300 truncate">
                        {selectedCompetitionName}
                      </p>
                      <p className="text-xs text-emerald-400/60">Competition Leaderboard</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClearCompetition}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-medium transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Global Board
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============================================ */}
            {/* Main Content Views                           */}
            {/* ============================================ */}
            <AnimatePresence mode="wait">
              {currentView === 'leaderboard' && (
                <motion.div
                  key="leaderboard"
                  initial={viewTransitionInitial}
                  animate={viewTransitionAnimate}
                  exit={viewTransitionExit}
                  transition={viewTransitionDuration}
                  className="w-full"
                >
                  <LeaderboardView
                    boardType={boardType}
                    timeFilter={timeFilter}
                    date={selectedDate}
                    competitionId={selectedCompetition}
                    currentUserId={user?.id}
                  />
                </motion.div>
              )}

              {currentView === 'around-me' && (
                <motion.div
                  key="around-me"
                  initial={viewTransitionInitial}
                  animate={viewTransitionAnimate}
                  exit={viewTransitionExit}
                  transition={viewTransitionDuration}
                  className="w-full"
                >
                  <AroundMeView
                    data={aroundMeData}
                    currentUserId={user?.id}
                    isLoading={aroundMeLoading}
                    onJumpToTop={() => setCurrentView('leaderboard')}
                  />
                </motion.div>
              )}

              {currentView === 'competitions' && (
                <motion.div
                  key="competitions"
                  initial={viewTransitionInitial}
                  animate={viewTransitionAnimate}
                  exit={viewTransitionExit}
                  transition={viewTransitionDuration}
                  className="w-full"
                >
                  {competitions && competitions.length > 0 ? (
                    <CompetitionsSection
                      competitions={competitions}
                      onSelectCompetition={setSelectedCompetition}
                      selectedCompetitionId={selectedCompetition}
                      currentUserId={user?.id}
                      userCompetitions={Array.from(userJoinedIds)}
                      onJoinCompetition={handleJoinCompetition}
                      onLeaveCompetition={handleLeaveCompetition}
                      onViewDetails={handleViewDetails}
                      onViewLeaderboard={handleViewLeaderboard}
                    />
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="backdrop-blur-xl bg-white/3 border border-white/8 rounded-2xl p-12 text-center"
                    >
                      <motion.div 
                        className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center"
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      >
                        <Swords className="w-6 h-6 text-gray-500" />
                      </motion.div>
                      <p className="text-gray-300 text-lg font-medium">No active competitions</p>
                      <p className="text-gray-500 text-sm mt-1.5">Check back later for new challenges!</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Competition Detail Dialog — reuses the same CompetitionDetailView as /competitions */}
      {detailCompetition && (
        <Dialog
          open={detailModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDetailModalOpen(false);
              setDetailCompetition(null);
              setIsFullscreen(false);
            }
          }}
        >
          <DialogContent
            className={cn(
              'bg-gray-950 border-white/10 p-0 gap-0 overflow-hidden overflow-y-auto transition-all duration-300',
              isFullscreen
                ? 'max-w-full w-full h-full max-h-full rounded-none'
                : 'max-w-3xl max-h-[90vh]',
            )}
            showCloseButton={false}
          >
            <DialogTitle className="sr-only">Competition Details</DialogTitle>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-gray-950/90 backdrop-blur-xl px-6 py-3">
              <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-400" />
                Competition Details
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsFullscreen((f) => !f)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    setDetailCompetition(null);
                    setIsFullscreen(false);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  aria-label="Close competition details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <CompetitionDetailView
                competition={detailCompetition}
                userEntry={buildUserEntry(detailCompetition)}
                currentUserId={user?.id}
                onJoin={(id) => {
                  handleJoinCompetition(id);
                }}
                onLeave={(id) => {
                  handleLeaveCompetition(id);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ErrorBoundary>
  );
}
