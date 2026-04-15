'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LeaderboardSkeletonProps {
  variant?: 'podium' | 'list' | 'filters' | 'score-card' | 'full';
}

export function LeaderboardSkeleton({ variant = 'full' }: LeaderboardSkeletonProps) {
  if (variant === 'podium') {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex items-end justify-center gap-4 md:gap-8">
          {[2, 1, 3].map((rank, index) => (
            <motion.div
              key={rank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center space-y-3"
            >
              <Skeleton className={cn(
                'rounded-full',
                rank === 1 ? 'w-24 h-24 md:w-32 md:h-32' : 'w-20 h-20 md:w-24 md:h-24'
              )} />
              <Skeleton className="h-4 w-20" />
              <Skeleton className={cn(
                'rounded-full',
                rank === 1 ? 'w-20 h-4' : 'w-16 h-3'
              )} />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4"
            >
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'filters') {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'score-card') {
    return (
      <div className="bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-500/20 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-12 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Full skeleton
  return (
    <div className="space-y-6">
      <LeaderboardSkeleton variant="score-card" />
      <LeaderboardSkeleton variant="filters" />
      <LeaderboardSkeleton variant="podium" />
      <LeaderboardSkeleton variant="list" />
    </div>
  );
}

