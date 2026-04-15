'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trophy, Award, Users, Calendar, Clock } from 'lucide-react';
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
      <AlertDialogContent className="bg-[#0f0f18] border-white/[0.08] rounded-xl shadow-2xl max-w-md p-0 overflow-hidden">
        {/* Header */}
        <AlertDialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15">
              <Trophy className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-semibold text-white">
                Join Competition
              </AlertDialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Your progress will be tracked on the leaderboard
              </p>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Competition info card */}
        <div className="px-6 py-4">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h4 className="text-sm font-semibold text-white mb-1">
              {competition.name}
            </h4>
            {competition.description && (
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{competition.description}</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {formatDate(startDate)} – {formatDate(endDate)}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className={daysRemaining > 3 ? 'text-slate-400' : 'text-amber-400'}>
                  {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ending today'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-400/80">
                <Users className="w-3.5 h-3.5" />
                {participantCount.toLocaleString()} participants
              </div>
            </div>

            {competition.prize_metadata?.badges && competition.prize_metadata.badges.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {competition.prize_metadata.badges.slice(0, 3).map((badge, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-amber-500/8 text-amber-400/80 text-[10px] font-medium rounded-md border border-amber-500/10"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter className="px-6 pb-5 pt-0 gap-2 sm:gap-2">
          <AlertDialogCancel
            disabled={isLoading}
            className="flex-1 h-9 border-white/[0.08] bg-transparent text-slate-300 hover:bg-white/[0.04] hover:text-white rounded-lg text-xs font-medium"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-emerald-500/20"
          >
            {isLoading ? 'Joining...' : 'Join Competition'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
