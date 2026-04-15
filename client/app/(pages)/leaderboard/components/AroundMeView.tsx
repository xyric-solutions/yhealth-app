'use client';

import { motion } from 'framer-motion';
import { ArrowUp, TrendingUp, TrendingDown, Target, Activity, Zap, Sparkles, Users } from 'lucide-react';
import type { LeaderboardResponse } from '@/src/shared/services/leaderboard.service';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface AroundMeViewProps {
  data: LeaderboardResponse | null;
  currentUserId?: string;
  isLoading?: boolean;
  onJumpToTop?: () => void;
}

export function AroundMeView({
  data,
  currentUserId,
  isLoading,
  onJumpToTop,
}: AroundMeViewProps) {
  const userEntryRef = useRef<HTMLDivElement>(null);

  // Find current user's entry
  const userIndex = data?.ranks.findIndex((entry) => entry.user_id === currentUserId) ?? -1;
  const userEntry = userIndex >= 0 ? data?.ranks[userIndex] : null;
  const previousRank = userEntry?.rank ? userEntry.rank - 1 : null;

  // Get entries around the user (5 above, user, 5 below)
  const range = 5;
  const startIndex = Math.max(0, userIndex - range);
  const endIndex = Math.min((data?.ranks.length ?? 0), userIndex + range + 1);
  const aroundMeEntries = data?.ranks.slice(startIndex, endIndex) ?? [];
  const startRank = startIndex + 1;

  // Scroll to user on mount
  useEffect(() => {
    if (userEntryRef.current) {
      setTimeout(() => {
        userEntryRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 500);
    }
  }, [userEntry]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 sm:p-12"
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500"
          />
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-gray-400 font-medium"
          >
            Loading your rank...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  if (!data || !userEntry) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full"
      >
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-purple-500/10 to-pink-500/10 blur-2xl" />
        
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 sm:p-12 text-center overflow-hidden">
          {/* Animated Grid Pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Floating Particles Effect */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-emerald-400/30"
              style={{
                left: `${20 + i * 15}%`,
                top: `${10 + (i % 3) * 30}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.3,
              }}
            />
          ))}

          {/* Main Icon Container */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: 0.2,
            }}
            className="relative w-24 h-24 mx-auto mb-6"
          >
            {/* Outer Glow Ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/20 via-purple-500/20 to-pink-500/20 blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.7, 0.4],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Middle Pulse Ring */}
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-emerald-400/30"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Icon Background */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-white/10 flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {/* Animated Icon */}
              <motion.div
                animate={{
                  y: [0, -8, 0],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="relative z-10"
              >
                <Target className="w-12 h-12 text-emerald-400" strokeWidth={2.5} />
              </motion.div>

              {/* Sparkle Effects */}
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    top: `${25 + (i % 2) * 50}%`,
                    left: `${25 + Math.floor(i / 2) * 50}%`,
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: 'easeInOut',
                  }}
                >
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="relative z-10"
          >
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
              You&apos;re not on this leaderboard yet
            </h3>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Start logging activities to see your rank and compete with others!
            </p>

            {/* Call to Action Icons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex items-center justify-center gap-6 mt-6"
            >
              {[
                { icon: Activity, label: 'Log Activities', color: 'text-blue-400' },
                { icon: Zap, label: 'Earn Points', color: 'text-yellow-400' },
                { icon: TrendingUp, label: 'Climb Ranks', color: 'text-emerald-400' },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + index * 0.1, type: 'spring', stiffness: 200 }}
                    whileHover={{ scale: 1.1, y: -5 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                      <Icon className={cn('w-5 h-5', item.color)} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 w-full"
    >
      {/* User's Rank Summary */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative overflow-hidden bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-500/20 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 shadow-lg shadow-purple-500/10"
      >
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-[0.05]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        {/* Shimmer Effect */}
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
        <div className="relative z-10 flex items-center justify-between mb-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              Your Rank
            </h3>
            <p className="text-gray-300 text-sm">
              {data.type === 'global' ? 'Global' : data.type === 'country' ? 'Country' : 'Friends'} Leaderboard
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="text-right"
          >
            <motion.div
              className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-1"
              animate={{
                backgroundPosition: ['0%', '100%', '0%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              #{userEntry.rank}
            </motion.div>
            <div className="text-sm text-gray-400">
              of {data.pagination.total.toLocaleString()} participants
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="text-gray-400 text-sm mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Your Score
            </div>
            <motion.div
              className="text-2xl sm:text-3xl font-bold text-white"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
            >
              {Number(userEntry.total_score).toFixed(1)}
            </motion.div>
          </motion.div>
          {previousRank && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05 }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm border',
                previousRank < userEntry.rank
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : previousRank > userEntry.rank
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
              )}
            >
              {previousRank < userEntry.rank ? (
                <>
                  <motion.div
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <TrendingDown className="w-4 h-4" />
                  </motion.div>
                  <span>Down {userEntry.rank - previousRank}</span>
                </>
              ) : previousRank > userEntry.rank ? (
                <>
                  <motion.div
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </motion.div>
                  <span>Up {previousRank - userEntry.rank}</span>
                </>
              ) : (
                <span>No change</span>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Jump to Top Button */}
      {onJumpToTop && userEntry.rank > 10 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onJumpToTop}
              variant="outline"
              className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 backdrop-blur-sm"
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowUp className="w-4 h-4 mr-2" />
              </motion.div>
              Jump to Top
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Around Me List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 overflow-hidden"
      >
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        
        <h4 className="relative z-10 text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Around You
        </h4>
        <div className="relative z-10 space-y-2">
          {aroundMeEntries.map((entry, index) => {
            const rank = startRank + index;
            const isCurrentUser = entry.user_id === currentUserId;

            return (
              <motion.div
                key={entry.user_id}
                ref={isCurrentUser ? userEntryRef : null}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ 
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 200,
                  damping: 20
                }}
                whileHover={{ 
                  scale: 1.02,
                  x: 4,
                  transition: { duration: 0.2 }
                }}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl relative overflow-hidden',
                  'bg-white/5 hover:bg-white/10 transition-all duration-300',
                  'border border-white/5 hover:border-white/10',
                  isCurrentUser && 'ring-2 ring-purple-500/50 bg-gradient-to-r from-purple-500/20 to-pink-500/20 shadow-lg shadow-purple-500/20'
                )}
              >
                {/* Shimmer effect for current user */}
                {isCurrentUser && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 1,
                      ease: 'easeInOut',
                    }}
                  />
                )}

                <motion.div
                  className="flex-shrink-0 w-12 text-center"
                  whileHover={{ scale: 1.1 }}
                >
                  <span
                    className={cn(
                      'text-lg font-bold',
                      isCurrentUser ? 'text-purple-300' : 'text-gray-400'
                    )}
                  >
                    #{rank}
                  </span>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <p className={cn(
                      'font-semibold truncate',
                      isCurrentUser ? 'text-purple-300 font-bold' : 'text-white'
                    )}>
                      {entry.user?.name || 'Anonymous'}
                      {isCurrentUser && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="ml-2 text-xs text-purple-400 font-medium"
                        >
                          (You)
                        </motion.span>
                      )}
                    </p>
                    <motion.span
                      className="text-white font-bold text-lg"
                      whileHover={{ scale: 1.1 }}
                    >
                      {Number(entry.total_score).toFixed(1)}
                    </motion.span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

