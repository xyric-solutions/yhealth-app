'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Users, Award, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import type { Competition, CompetitionEntry, LeaderboardResponse } from '@/src/shared/services/leaderboard.service';
import { joinCompetition, leaveCompetition, getCompetitionLeaderboard } from '@/src/shared/services/leaderboard.service';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { LeaderboardList } from './LeaderboardList';

interface CompetitionDetailsModalProps {
  competition: Competition | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  userEntry?: CompetitionEntry | null;
  onJoin?: (competitionId: string) => void;
  onLeave?: (competitionId: string) => void;
}

export function CompetitionDetailsModal({
  competition,
  isOpen,
  onClose,
  currentUserId,
  userEntry,
  onJoin,
  onLeave,
}: CompetitionDetailsModalProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const prevCompetitionId = useRef<string | null>(null);

  const isJoined = !!userEntry;

  // Clear leaderboard data when competition changes
  useEffect(() => {
    if (competition?.id !== prevCompetitionId.current) {
      prevCompetitionId.current = competition?.id ?? null;
      setLeaderboardData(null);
    }
  }, [competition?.id]);

  const handleJoin = async () => {
    if (!competition) return;

    setIsJoining(true);
    try {
      await joinCompetition(competition.id);
      onJoin?.(competition.id);
      toast.success(`Joined "${competition.name}"!`, {
        description: 'Your progress will be tracked on the leaderboard.',
        duration: 4000,
      });

      // Load leaderboard after joining
      loadLeaderboard();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 409) {
          onJoin?.(competition.id);
          toast.info('You are already part of this competition!');
        } else if (error.statusCode === 403) {
          toast.error('Not eligible for this competition', { description: error.message });
        } else {
          toast.error('Failed to join competition', { description: error.message });
        }
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to join competition');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!competition) return;
    setIsLeaving(true);
    try {
      await leaveCompetition(competition.id);
      onLeave?.(competition.id);
      toast.success('Left competition', {
        description: 'You can rejoin anytime before it ends.',
        duration: 3000,
      });
    } catch (error) {
      toast.error('Failed to leave competition', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLeaving(false);
    }
  };

  const loadLeaderboard = async () => {
    if (!competition) return;

    setIsLoadingLeaderboard(true);
    try {
      const data = await getCompetitionLeaderboard(competition.id);
      setLeaderboardData(data);
    } catch (error) {
      console.error('Failed to load competition leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Load leaderboard when modal opens and competition is joined
  useEffect(() => {
    if (isOpen && isJoined && !leaderboardData) {
      loadLeaderboard();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isJoined]);

  if (!competition) return null;

  const startDate = new Date(competition.start_date);
  const endDate = new Date(competition.end_date);
  const now = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            {competition.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {competition.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Competition Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Calendar className="w-4 h-4" />
                Duration
              </div>
              <div className="text-white font-semibold">
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
              </div>
              {daysRemaining > 0 && (
                <div className="text-yellow-400 text-sm mt-1">
                  {daysRemaining} days remaining
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Users className="w-4 h-4" />
                Status
              </div>
              <div className="text-white font-semibold capitalize">{competition.status}</div>
              {competition.type === 'ai_generated' && (
                <div className="text-purple-400 text-sm mt-1">AI Generated</div>
              )}
            </div>
          </div>

          {/* Rules */}
          {competition.rules && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Rules
              </h4>
              <div className="text-gray-300 text-sm space-y-1">
                {Object.entries(competition.rules).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eligibility */}
          {competition.eligibility && Object.keys(competition.eligibility).length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">Eligibility</h4>
              <div className="text-gray-300 text-sm space-y-1">
                {Object.entries(competition.eligibility).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-400 capitalize">{key}:</span>{' '}
                    <span>{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prizes */}
          {competition.prize_metadata && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-400" />
                Prizes
              </h4>
              {competition.prize_metadata.badges && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {competition.prize_metadata.badges.map((badge, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full border border-yellow-500/30"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
              {competition.prize_metadata.rewards && (
                <div className="text-gray-300 text-sm">
                  {competition.prize_metadata.rewards.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Join/Leave Button */}
          <div className="flex gap-2">
            {isJoined ? (
              <>
                <Button
                  onClick={handleLeave}
                  disabled={isLeaving}
                  variant="outline"
                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  {isLeaving ? (
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
                {userEntry && (
                  <div className="bg-purple-500/20 rounded-lg p-4 flex-1">
                    <div className="text-gray-400 text-sm mb-1">Your Rank</div>
                    <div className="text-purple-300 font-bold text-2xl">
                      #{userEntry.current_rank || 'N/A'}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">
                      Score: {userEntry.current_score?.toFixed(1) || '0.0'}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Button
                onClick={handleJoin}
                disabled={isJoining || competition.status !== 'active'}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isJoining ? (
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
          </div>

          {/* Leaderboard Preview */}
          {isJoined && (
            <div>
              <h4 className="text-white font-semibold mb-4">Leaderboard</h4>
              {isLoadingLeaderboard ? (
                <div className="text-center text-gray-400 py-8">Loading leaderboard...</div>
              ) : leaderboardData ? (
                <LeaderboardList
                  entries={leaderboardData.ranks.slice(0, 10)}
                  startRank={1}
                  total={leaderboardData.pagination.total}
                  currentUserId={currentUserId}
                />
              ) : (
                <Button onClick={loadLeaderboard} variant="outline" className="w-full">
                  Load Leaderboard
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

