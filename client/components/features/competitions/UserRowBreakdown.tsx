'use client';

import { motion } from 'framer-motion';
import { Dumbbell, Utensils, Brain, HeartPulse, ListChecks, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import type { LeaderboardEntry } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserRowBreakdownProps {
  entry: LeaderboardEntry;
  rank: number;
  isCurrentUser?: boolean;
  previousRank?: number;
  showBreakdown?: boolean;
  onToggleBreakdown?: () => void;
}

export function UserRowBreakdown({
  entry,
  rank,
  isCurrentUser = false,
  previousRank,
  showBreakdown = false,
  onToggleBreakdown,
}: UserRowBreakdownProps) {
  const rankChange = previousRank ? previousRank - rank : null;
  const raw = (entry.component_scores ?? {}) as unknown as Record<string, number>;
  const scores = {
    workout: raw.workout ?? 0,
    nutrition: raw.nutrition ?? 0,
    wellbeing: raw.wellbeing ?? 0,
    biometrics: raw.biometrics ?? 0,
    engagement: raw.engagement ?? raw.participation ?? 0,
    consistency: raw.consistency ?? 0,
  };
  const components = [
    {
      label: 'Workout',
      value: scores.workout,
      icon: Dumbbell,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
    },
    {
      label: 'Nutrition',
      value: scores.nutrition,
      icon: Utensils,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      label: 'Wellbeing',
      value: scores.wellbeing,
      icon: Brain,
      color: 'from-purple-500 to-violet-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      label: 'Biometrics',
      value: scores.biometrics,
      icon: HeartPulse,
      color: 'from-pink-500 to-rose-500',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/30',
    },
    {
      label: 'Engagement',
      value: scores.engagement,
      icon: ListChecks,
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      label: 'Consistency',
      value: scores.consistency,
      icon: Flame,
      color: 'from-amber-500 to-yellow-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border transition-all duration-300',
        isCurrentUser
          ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
          : 'bg-white/5 border-white/10 hover:bg-white/10',
        showBreakdown && 'bg-white/10'
      )}
    >
      {/* Main Row */}
      <div
        className={cn(
          'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer',
          onToggleBreakdown && 'hover:bg-white/5'
        )}
        onClick={onToggleBreakdown}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-10 sm:w-12 text-center">
          <div className="flex flex-col items-center gap-1">
            <motion.span
              className={cn(
                'text-lg sm:text-xl font-bold',
                rank <= 3 ? 'text-emerald-400' : 'text-gray-400',
                isCurrentUser && 'text-emerald-300'
              )}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              #{rank}
            </motion.span>
            {rankChange !== null && rankChange !== 0 && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className={cn(
                  'flex items-center gap-0.5 text-xs font-semibold',
                  rankChange > 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {rankChange > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{Math.abs(rankChange)}</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Avatar */}
        <motion.div whileHover={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}>
          <Avatar
            className={cn(
              'w-12 h-12 sm:w-14 sm:h-14 border-2',
              isCurrentUser ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/20' : 'border-white/20'
            )}
          >
            <AvatarImage src={entry.user?.avatar} alt={entry.user?.name || 'User'} />
            <AvatarFallback
              className={cn(
                'text-white font-semibold',
                isCurrentUser
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  : 'bg-gradient-to-br from-emerald-500/80 to-emerald-600/80'
              )}
            >
              {entry.user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        {/* Name and Total Score */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <p
                className={cn(
                  'font-semibold truncate text-sm sm:text-base',
                  isCurrentUser ? 'text-emerald-300 font-bold' : 'text-white'
                )}
              >
                {entry.user?.name || 'Anonymous'}
              </p>
              {isCurrentUser && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full border border-emerald-500/30">
                  You
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <motion.span
                className="text-white font-bold text-base sm:text-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
              >
                {Number(entry.total_score).toFixed(1)}
              </motion.span>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Number(entry.total_score)}%` }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Component Breakdown (Expandable) */}
      {showBreakdown && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden border-t border-white/10"
        >
          <div className="p-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Component Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {components.map((component, index) => {
                const Icon = component.icon;
                return (
                  <motion.div
                    key={component.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      'p-3 rounded-lg border',
                      component.bgColor,
                      component.borderColor
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn('w-4 h-4', `text-${component.color.split('-')[1]}-400`)} />
                      <span className="text-xs font-medium text-gray-300">{component.label}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">{component.value.toFixed(0)}</span>
                        <span className="text-xs text-gray-400">/100</span>
                      </div>
                      <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full bg-gradient-to-r rounded-full', component.color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${component.value}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
