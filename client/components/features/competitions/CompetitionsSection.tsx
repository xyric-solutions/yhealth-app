'use client';

import { motion } from 'framer-motion';
import { Trophy, Calendar, Users, Award, Clock, Sparkles, CheckCircle, XCircle, Loader2, TrendingUp, ChevronRight } from 'lucide-react';
import type { Competition } from '@/src/shared/services/leaderboard.service';
import { joinCompetition, leaveCompetition } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  onViewDetails?: (competition: Competition) => void;
  onViewLeaderboard?: (competitionId: string) => void;
}

export function CompetitionsSection({
  competitions,
  onSelectCompetition,
  selectedCompetitionId,
  currentUserId: _currentUserId,
  userCompetitions = [],
  onJoinCompetition,
  onLeaveCompetition,
  onViewDetails,
  onViewLeaderboard,
}: CompetitionsSectionProps) {
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedCompetitionForJoin, setSelectedCompetitionForJoin] = useState<Competition | null>(null);

  // Sort competitions: active first, then ended, by start date descending
  const sortedCompetitions = useMemo(() => {
    return [...competitions].sort((a, b) => {
      const aEnded = a.status === 'ended' || new Date(a.end_date) < new Date();
      const bEnded = b.status === 'ended' || new Date(b.end_date) < new Date();
      if (aEnded !== bEnded) return aEnded ? 1 : -1;
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
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

      toast.success(
        `Successfully joined "${selectedCompetitionForJoin.name}"! Good luck!`,
        {
          duration: 4000,
          description: 'Your progress will be tracked on the leaderboard',
        }
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 409) {
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to join competition';
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
      await leaveCompetition(competitionId);
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

  if (sortedCompetitions.length === 0) {
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

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Competitions
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCompetitions.map((competition, index) => {
          const isSelected = selectedCompetitionId === competition.id;
          const startDate = new Date(competition.start_date);
          const endDate = new Date(competition.end_date);
          const now = new Date();
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isJoined = userCompetitions.includes(competition.id);
          const isEndingSoon = daysRemaining <= 3 && daysRemaining > 0;
          const isEnded = competition.status === 'ended' || endDate < now;
          const participantCount = (competition as Competition & { participant_count?: number }).participant_count ?? 0;

          return (
            <motion.div
              key={competition.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              onClick={() => {
                if (onViewDetails) {
                  onViewDetails(competition);
                } else {
                  onSelectCompetition(isSelected ? null : competition.id);
                }
              }}
              className={cn(
                'bg-white/5 backdrop-blur-sm border rounded-2xl p-6 cursor-pointer',
                'transition-all duration-300 relative overflow-hidden',
                isSelected
                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
                  : 'border-white/10 hover:border-white/20',
                isEndingSoon && 'ring-2 ring-yellow-500/50',
                isEnded && !isJoined && 'opacity-80'
              )}
            >
              {/* Prize Animation Background */}
              {competition.prize_metadata?.badges && competition.prize_metadata.badges.length > 0 && (
                <motion.div
                  className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-bl-full blur-xl"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}

              <div className="relative z-10">
                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge
                    className={cn(
                      'border-0 text-[10px] uppercase tracking-wider',
                      isEnded
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    )}
                  >
                    <span
                      className={cn(
                        'mr-1 inline-block h-1.5 w-1.5 rounded-full',
                        isEnded ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'
                      )}
                    />
                    {isEnded ? 'Ended' : 'Active'}
                  </Badge>

                  {competition.type === 'ai_generated' && (
                    <Badge className="border-0 bg-purple-500/15 text-purple-400 text-[10px] uppercase tracking-wider">
                      <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                      AI Generated
                    </Badge>
                  )}

                  {isJoined && (
                    <Badge className="border-0 bg-emerald-500/20 text-emerald-300 text-[10px] uppercase tracking-wider">
                      <CheckCircle className="mr-0.5 h-2.5 w-2.5" />
                      Joined
                    </Badge>
                  )}

                  {isEndingSoon && (
                    <Badge className="border-0 bg-amber-500/15 text-amber-400 text-[10px] uppercase tracking-wider animate-pulse">
                      <Clock className="mr-0.5 h-2.5 w-2.5" />
                      Ending Soon
                    </Badge>
                  )}
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg mb-2">{competition.name}</h3>
                    {competition.description && (
                      <p className="text-gray-400 text-sm line-clamp-2">{competition.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDate(startDate)} - {formatDate(endDate)}
                    </span>
                  </div>

                  {/* Countdown Timer - only for active */}
                  {!isEnded && <CountdownTimer endDate={endDate} />}

                  {/* Participant Count */}
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{participantCount.toLocaleString()} participants</span>
                  </div>
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

                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                  {/* View Leaderboard - show for joined or ended competitions */}
                  {(isJoined || isEnded) && onViewLeaderboard && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewLeaderboard(competition.id);
                      }}
                      className="flex-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/20 h-9 text-xs"
                    >
                      <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                      View Leaderboard
                      <ChevronRight className="ml-1 h-3 w-3 opacity-50" />
                    </Button>
                  )}

                  {/* Join button - only for active, not joined */}
                  {!isJoined && !isEnded && (
                    <Button
                      onClick={(e) => handleJoinClick(competition, e)}
                      disabled={joining === competition.id || competition.status !== 'active'}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {joining === competition.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Join Competition
                        </>
                      )}
                    </Button>
                  )}

                  {/* Leave button - only for joined active competitions */}
                  {isJoined && !isEnded && (
                    <Button
                      onClick={(e) => handleLeave(competition.id, e)}
                      disabled={leaving === competition.id}
                      variant="outline"
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 h-9 w-9 p-0 shrink-0"
                      aria-label="Leave competition"
                    >
                      {leaving === competition.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        </div>
      </div>
    </>
  );
}
