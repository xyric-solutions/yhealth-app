'use client';

import { motion } from 'framer-motion';
import { Trophy, Calendar, Users, Award, Clock, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Competition } from '@/src/shared/services/leaderboard.service';
import { joinCompetition } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { JoinCompetitionModal } from './JoinCompetitionModal';

// Format date helper
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Countdown timer component
function CountdownTimer({ endDate }: { endDate: Date }) {
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = endDate.getTime();
      const difference = end - now;

      if (difference > 0) {
        setTimeRemaining({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  if (timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && timeRemaining.seconds === 0) {
    return <span className="text-red-400 text-sm font-semibold">Ended</span>;
  }

  return (
    <div className="flex items-center gap-1 text-yellow-400 text-sm font-semibold">
      <Clock className="w-4 h-4" />
      <span>
        {timeRemaining.days > 0 && `${timeRemaining.days}d `}
        {timeRemaining.hours}h {timeRemaining.minutes}m
      </span>
    </div>
  );
}

interface CompetitionsSectionProps {
  competitions: Competition[];
  onSelectCompetition: (competitionId: string | null) => void;
  selectedCompetitionId: string | null;
  currentUserId?: string;
  userCompetitions?: string[]; // IDs of competitions user has joined
  onJoinCompetition?: (competitionId: string) => void;
  onLeaveCompetition?: (competitionId: string) => void;
}

export function CompetitionsSection({
  competitions,
  onSelectCompetition,
  selectedCompetitionId,
  currentUserId: _currentUserId,
  userCompetitions = [],
  onJoinCompetition,
  onLeaveCompetition,
}: CompetitionsSectionProps) {
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedCompetitionForJoin, setSelectedCompetitionForJoin] = useState<Competition | null>(null);
  
  // Memoize active competitions for performance
  const activeCompetitions = useMemo(() => {
    return competitions.filter((c) => {
      if (c.status !== 'active') return false;
      const now = new Date();
      const startDate = new Date(c.start_date);
      const endDate = new Date(c.end_date);
      return now >= startDate && now <= endDate;
    });
  }, [competitions]);

  // Validation: Check if competition can be joined
  const canJoinCompetition = useCallback((competition: Competition): { canJoin: boolean; reason?: string } => {
    const now = new Date();
    const startDate = new Date(competition.start_date);
    const endDate = new Date(competition.end_date);

    if (competition.status !== 'active') {
      return { canJoin: false, reason: 'Competition is not active' };
    }

    if (now < startDate) {
      return { canJoin: false, reason: 'Competition has not started yet' };
    }

    if (now > endDate) {
      return { canJoin: false, reason: 'Competition has ended' };
    }

    return { canJoin: true };
  }, []);

  const handleJoinClick = useCallback((competition: Competition, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Validate before showing modal
    const validation = canJoinCompetition(competition);
    if (!validation.canJoin) {
      toast.error(validation.reason || 'Cannot join this competition');
      return;
    }

    // Check if already joined
    if (userCompetitions.includes(competition.id)) {
      toast.info('You have already joined this competition');
      return;
    }

    setSelectedCompetitionForJoin(competition);
    setJoinModalOpen(true);
  }, [userCompetitions, canJoinCompetition]);

  const handleJoinConfirm = useCallback(async () => {
    if (!selectedCompetitionForJoin) return;

    const competitionId = selectedCompetitionForJoin.id;
    setJoining(competitionId);
    setJoinModalOpen(false);
    
    try {
      await joinCompetition(competitionId);
      onJoinCompetition?.(competitionId);
      
      // Success message with competition details
      toast.success(
        `🎉 Successfully joined "${selectedCompetitionForJoin.name}"! Good luck!`,
        {
          duration: 4000,
          description: 'Your progress will be tracked on the leaderboard',
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join competition';
      
      // Handle different error types
      if (error instanceof ApiError) {
        if (error.statusCode === 409) {
          // Already joined - update UI silently
          onJoinCompetition?.(competitionId);
          toast.info('You are already part of this competition!', {
            description: 'Check your rank on the leaderboard',
          });
        } else if (error.statusCode === 403) {
          toast.error('You are not eligible for this competition', {
            description: error.message,
          });
        } else if (error.statusCode === 404) {
          toast.error('Competition not found', {
            description: 'This competition may have been removed',
          });
        } else {
          toast.error('Failed to join competition', {
            description: error.message,
          });
        }
      } else {
        toast.error('Failed to join competition', {
          description: errorMessage,
        });
      }
    } finally {
      setJoining(null);
      setSelectedCompetitionForJoin(null);
    }
  }, [selectedCompetitionForJoin, onJoinCompetition]);

  const handleLeave = useCallback(async (competitionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaving(competitionId);
    
    try {
      // TODO: Implement leave API endpoint
      // await leaveCompetition(competitionId);
      onLeaveCompetition?.(competitionId);
      toast.success('Left competition successfully', {
        description: 'You can rejoin anytime before it ends',
        duration: 3000,
      });
    } catch (error) {
      toast.error('Failed to leave competition', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setLeaving(null);
    }
  }, [onLeaveCompetition]);

  if (activeCompetitions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Join Competition Modal */}
      {selectedCompetitionForJoin && (
        <JoinCompetitionModal
          open={joinModalOpen}
          onOpenChange={setJoinModalOpen}
          competition={selectedCompetitionForJoin}
          participantCount={(selectedCompetitionForJoin as Competition & { participant_count?: number }).participant_count ?? 0}
          onConfirm={handleJoinConfirm}
          isLoading={joining === selectedCompetitionForJoin.id}
        />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 w-full"
      >
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  repeatDelay: 2,
                }}
                className="relative"
              >
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-yellow-400/30 blur-xl"
                  animate={{
                    opacity: [0.4, 0.7, 0.4],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center backdrop-blur-sm">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                </div>
              </motion.div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                  Active Competitions
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Join challenges and compete for rewards
                </p>
              </div>
            </div>
            
            {/* Stats Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 backdrop-blur-sm"
            >
              <div className="text-emerald-300 text-sm font-semibold">
                {activeCompetitions.length} Active
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {activeCompetitions.map((competition, index) => {
          const isSelected = selectedCompetitionId === competition.id;
          const startDate = new Date(competition.start_date);
          const endDate = new Date(competition.end_date);
          const now = new Date();
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isJoined = userCompetitions.includes(competition.id);
          const isEndingSoon = daysRemaining <= 3 && daysRemaining > 0;
          const participantCount = (competition as Competition & { participant_count?: number }).participant_count ?? 0;

          return (
            <motion.div
              key={competition.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                delay: index * 0.1,
                type: 'spring',
                stiffness: 200,
                damping: 20
              }}
              whileHover={{ 
                scale: 1.03, 
                y: -6,
                transition: { duration: 0.2 }
              }}
              onClick={() => onSelectCompetition(isSelected ? null : competition.id)}
              className={cn(
                'bg-gradient-to-br from-white/5 via-white/3 to-white/5 backdrop-blur-xl border rounded-2xl p-6 cursor-pointer',
                'transition-all duration-300 relative overflow-hidden group',
                isSelected
                  ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-teal-500/20 shadow-2xl shadow-emerald-500/30 ring-2 ring-emerald-500/30'
                  : 'border-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-purple-500/10',
                isEndingSoon && 'ring-2 ring-yellow-500/50 animate-pulse'
              )}
            >
              {/* Animated background gradient */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
              
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 2,
                  ease: 'easeInOut',
                }}
              />
              {/* Enhanced Status Indicator */}
              <div className="absolute top-4 right-4 z-20">
                {isJoined ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="relative"
                  >
                    <motion.div
                      className="absolute inset-0 bg-green-500 rounded-full blur-md"
                      animate={{
                        opacity: [0.5, 1, 0.5],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                    <div className="relative w-4 h-4 bg-green-500 rounded-full ring-2 ring-green-500/50 shadow-lg">
                      <motion.div
                        className="absolute inset-0 rounded-full bg-green-400"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.7, 0, 0.7],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <div className="w-4 h-4 bg-gray-500/50 rounded-full border border-gray-500/30" />
                )}
              </div>

              {/* Enhanced Prize Animation Background */}
              {competition.prize_metadata?.badges && competition.prize_metadata.badges.length > 0 && (
                <>
                  <motion.div
                    className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/30 to-orange-500/30 rounded-bl-full blur-2xl"
                    animate={{
                      opacity: [0.3, 0.7, 0.3],
                      scale: [1, 1.2, 1],
                      rotate: [0, 90, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  <motion.div
                    className="absolute top-2 right-2"
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <Sparkles className="w-6 h-6 text-yellow-400/50" />
                  </motion.div>
                </>
              )}

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <motion.h3
                      className="text-white font-bold text-lg sm:text-xl mb-2 line-clamp-1"
                      whileHover={{ scale: 1.02 }}
                    >
                      {competition.name}
                    </motion.h3>
                    {competition.description && (
                      <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
                        {competition.description}
                      </p>
                    )}
                  </div>
                  {competition.type === 'ai_generated' && (
                    <motion.span
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 shrink-0"
                    >
                      <motion.div
                        animate={{
                          rotate: [0, 360],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      >
                        <Sparkles className="w-3 h-3" />
                      </motion.div>
                      AI
                    </motion.span>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-2 text-gray-400 text-sm bg-white/5 rounded-lg px-3 py-2 border border-white/5"
                  >
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="flex-1">
                      {formatDate(startDate)} - {formatDate(endDate)}
                    </span>
                  </motion.div>
                  
                  {/* Enhanced Countdown Timer */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/20"
                  >
                    <CountdownTimer endDate={endDate} />
                  </motion.div>

                  {/* Enhanced Participant Count */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 text-emerald-400 text-sm font-semibold bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <Users className="w-4 h-4" />
                    </motion.div>
                    <span>{participantCount.toLocaleString()} participants</span>
                  </motion.div>
                </div>

                {/* Prize Badges with Animation */}
                {competition.prize_metadata?.badges && competition.prize_metadata.badges.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10"
                  >
                    <Award className="w-4 h-4 text-yellow-400" />
                    <div className="flex gap-1 flex-wrap">
                      {competition.prize_metadata.badges.slice(0, 3).map((badge, i) => (
                        <motion.span
                          key={i}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
                          className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30"
                        >
                          {badge}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Enhanced Join/Leave Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 pt-4 border-t border-white/10"
                >
                  {isJoined ? (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={(e) => handleLeave(competition.id, e)}
                        disabled={leaving === competition.id}
                        variant="outline"
                        className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 transition-all backdrop-blur-sm font-semibold"
                      >
                        {leaving === competition.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Leaving...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Leave Competition
                          </>
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={(e) => handleJoinClick(competition, e)}
                        disabled={joining === competition.id || competition.status !== 'active'}
                        className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-700 hover:via-emerald-600 hover:to-teal-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/30 font-semibold"
                      >
                        {joining === competition.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Joining...
                          </>
                        ) : (
                          <>
                            <motion.div
                              animate={{
                                scale: [1, 1.2, 1],
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                            </motion.div>
                            Join Competition
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </motion.div>

                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-white/10"
                  >
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCompetition(null);
                      }}
                      variant="outline"
                      className="w-full border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      View Leaderboard
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
        </div>
      </motion.div>
    </>
  );
}

