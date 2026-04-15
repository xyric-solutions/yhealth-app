'use client';

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaderboardEntry } from '@/src/shared/services/leaderboard.service';
import { Crown, Medal, Award } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UserRowBreakdown } from './UserRowBreakdown';

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  startRank: number;
  total: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  currentUserId?: string;
}

export function LeaderboardList({
  entries,
  startRank,
  total,
  onLoadMore,
  hasMore,
  isLoading = false,
  currentUserId,
}: LeaderboardListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          onLoadMore();
          setTimeout(() => setIsLoadingMore(false), 1000);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

  const _getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
    if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
    return null;
  };

  if (isLoading && entries.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-6" role="list" aria-label="Leaderboard entries">
      <div className="space-y-3" role="list">
        {entries.map((entry, index) => {
          const rank = startRank + index;
          const isCurrentUser = currentUserId === entry.user_id;
          const isExpanded = expandedRows.has(entry.user_id);

          return (
            <motion.div
              key={entry.user_id || `entry-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              role="listitem"
              aria-label={`Rank ${rank}: ${entry.user?.name || 'Anonymous'} with score ${Number(entry.total_score).toFixed(1)}`}
            >
              <UserRowBreakdown
                entry={entry}
                rank={rank}
                isCurrentUser={isCurrentUser}
                showBreakdown={isExpanded}
                onToggleBreakdown={() => {
                  setExpandedRows((prev) => {
                    const next = new Set(prev);
                    if (next.has(entry.user_id)) {
                      next.delete(entry.user_id);
                    } else {
                      next.add(entry.user_id);
                    }
                    return next;
                  });
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Infinite Scroll Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="mt-6 text-center">
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          )}
        </div>
      )}

      {/* Load More Button (fallback) */}
      {hasMore && onLoadMore && !isLoadingMore && (
        <div className="mt-6 text-center">
          <motion.button
            onClick={onLoadMore}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-semibold transition-all duration-300 shadow-lg"
          >
            Load More
          </motion.button>
        </div>
      )}

      {/* Total Count */}
      <div className="mt-4 text-center text-gray-400 text-sm">
        Showing {entries.length} of {total} participants
      </div>
    </div>
  );
}
