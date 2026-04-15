'use client';

import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trophy, Sparkles, Award, Users, Calendar, Clock } from 'lucide-react';
import type { Competition } from '@/src/shared/services/leaderboard.service';

interface JoinCompetitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: Competition | null;
  participantCount: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function JoinCompetitionModal({
  open,
  onOpenChange,
  competition,
  participantCount,
  onConfirm,
  isLoading = false,
}: JoinCompetitionModalProps) {
  if (!competition) return null;

  const startDate = new Date(competition.start_date);
  const endDate = new Date(competition.end_date);
  const now = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/50 rounded-2xl shadow-2xl max-w-md overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />
          
          <AlertDialogHeader className="relative z-10 pb-4">
            <div className="flex items-start gap-3 mb-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex-shrink-0"
              >
                <Trophy className="w-6 h-6 text-white" />
              </motion.div>
              <div className="flex-1">
                <AlertDialogTitle className="text-2xl font-bold text-white mb-2">
                  Join Competition
                </AlertDialogTitle>
                <p className="text-slate-300 text-sm">
                  Are you ready to compete? Your progress will be tracked and you&apos;ll appear on the leaderboard!
                </p>
              </div>
            </div>
          </AlertDialogHeader>

          {/* Competition Details */}
          <div className="relative z-10">
            <div className="bg-white/5 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="text-white font-semibold mb-1 flex items-center gap-2">
                  {competition.type === 'ai_generated' && (
                    <motion.span
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </motion.span>
                  )}
                  {competition.name}
                </h4>
                {competition.description && (
                  <p className="text-slate-400 text-sm">{competition.description}</p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>
                    {formatDate(startDate)} - {formatDate(endDate)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-yellow-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ended'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-emerald-400">
                  <Users className="w-4 h-4" />
                  <span>{participantCount.toLocaleString()} participants</span>
                </div>
              </div>

              {competition.prize_metadata?.badges && competition.prize_metadata.badges.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">Prizes</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {competition.prize_metadata.badges.slice(0, 3).map((badge, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <AlertDialogFooter className="relative z-10 gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={isLoading}
              className="border-slate-600 hover:bg-slate-800 text-slate-300"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
            >
              {isLoading ? 'Joining...' : 'Join Competition'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </motion.div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

