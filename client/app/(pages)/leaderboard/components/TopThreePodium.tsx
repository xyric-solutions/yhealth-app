'use client';

import { motion } from 'framer-motion';
import { Crown, Medal, Award } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { LeaderboardEntry } from '@/src/shared/services/leaderboard.service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TopThreePodiumProps {
  entries: LeaderboardEntry[];
}

/** Animated count-up hook */
function useCountUp(target: number, duration = 1200, delay = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(parseFloat((eased * target).toFixed(1)));
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);
  return value;
}

// Rank config
const RANK_CONFIG = {
  1: {
    ringColor: 'border-emerald-400',
    glowColor: 'rgba(16,185,129,0.5)',
    gradientFrom: 'from-emerald-400',
    gradientTo: 'to-teal-300',
    scoreColor: 'text-emerald-400',
    bgGlow: 'rgba(16,185,129,0.15)',
    podiumGradient: 'from-emerald-500/80 to-emerald-600/60',
    podiumHeight: 'h-20 sm:h-24 md:h-28',
    podiumWidth: 'w-24 sm:w-28 md:w-32',
    avatarSize: 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28',
    nameSize: 'text-sm sm:text-base md:text-lg',
    scoreSize: 'text-xl sm:text-2xl md:text-3xl',
  },
  2: {
    ringColor: 'border-blue-400',
    glowColor: 'rgba(96,165,250,0.4)',
    gradientFrom: 'from-blue-400',
    gradientTo: 'to-indigo-300',
    scoreColor: 'text-blue-400',
    bgGlow: 'rgba(96,165,250,0.1)',
    podiumGradient: 'from-blue-500/60 to-indigo-500/40',
    podiumHeight: 'h-14 sm:h-16 md:h-20',
    podiumWidth: 'w-20 sm:w-24 md:w-28',
    avatarSize: 'w-16 h-16 sm:w-20 sm:h-20 md:w-22 md:h-22',
    nameSize: 'text-xs sm:text-sm md:text-base',
    scoreSize: 'text-lg sm:text-xl md:text-2xl',
  },
  3: {
    ringColor: 'border-amber-400',
    glowColor: 'rgba(251,191,36,0.4)',
    gradientFrom: 'from-amber-400',
    gradientTo: 'to-orange-300',
    scoreColor: 'text-amber-400',
    bgGlow: 'rgba(251,191,36,0.1)',
    podiumGradient: 'from-amber-500/60 to-orange-500/40',
    podiumHeight: 'h-10 sm:h-12 md:h-16',
    podiumWidth: 'w-20 sm:w-24 md:w-28',
    avatarSize: 'w-16 h-16 sm:w-20 sm:h-20 md:w-22 md:h-22',
    nameSize: 'text-xs sm:text-sm md:text-base',
    scoreSize: 'text-lg sm:text-xl md:text-2xl',
  },
} as const;

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />;
  if (rank === 2) return <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-blue-300 drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]" />;
  if (rank === 3) return <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />;
  return null;
}

function PodiumEntry({
  entry,
  rank,
  score,
  delay,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  score: number;
  delay: number;
}) {
  const config = RANK_CONFIG[rank];

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'flex flex-col items-center',
        rank === 1 ? 'order-2 z-10' : rank === 2 ? 'order-1' : 'order-3'
      )}
    >
      {/* Avatar section */}
      <motion.div
        className="relative mb-2 sm:mb-3"
        whileHover={{ scale: 1.08, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-[-4px] sm:inset-[-5px] md:inset-[-6px] rounded-full"
          animate={{
            boxShadow: [
              `0 0 15px ${config.glowColor}, 0 0 30px ${config.bgGlow}`,
              `0 0 25px ${config.glowColor}, 0 0 50px ${config.bgGlow}`,
              `0 0 15px ${config.glowColor}, 0 0 30px ${config.bgGlow}`,
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Rank icon above avatar */}
        <motion.div
          className="absolute -top-6 sm:-top-7 md:-top-8 left-1/2 -translate-x-1/2 z-20"
          initial={{ y: -15, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.4, type: 'spring', stiffness: 200, damping: 12 }}
        >
          {rank === 1 ? (
            <motion.div
              animate={{ rotate: [0, -8, 8, -4, 0], y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
            >
              <RankIcon rank={rank} />
            </motion.div>
          ) : (
            <RankIcon rank={rank} />
          )}
        </motion.div>

        {/* Avatar with ring */}
        <div className={cn('relative rounded-full border-[3px] sm:border-4 overflow-hidden', config.ringColor, config.avatarSize)}>
          <Avatar className="w-full h-full">
            <AvatarImage src={entry.user?.avatar} alt={entry.user?.name || 'User'} />
            <AvatarFallback className={cn('bg-gradient-to-br text-white font-bold', config.gradientFrom, config.gradientTo, rank === 1 ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg')}>
              {entry.user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: rank === 1 ? 1 : 2, ease: 'easeInOut' }}
          />
        </div>

        {/* Orbiting dot for rank 1 */}
        {rank === 1 && (
          <motion.div
            className="absolute inset-[-8px] rounded-full z-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
          </motion.div>
        )}
      </motion.div>

      {/* Name */}
      <motion.p
        className={cn('text-white font-bold truncate max-w-20 sm:max-w-24 md:max-w-28 text-center', config.nameSize)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
      >
        {entry.user?.name || 'Anonymous'}
      </motion.p>

      {/* Score — large animated number */}
      <motion.p
        className={cn('font-extrabold font-mono tabular-nums', config.scoreColor, config.scoreSize)}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.5, type: 'spring', stiffness: 200 }}
      >
        {score.toFixed(0)}
      </motion.p>

      {/* Username / label */}
      <p className="text-gray-500 text-[10px] sm:text-xs">@balencia</p>

      {/* Podium bar */}
      <motion.div
        className={cn(
          'mt-2 sm:mt-3 rounded-t-xl relative overflow-hidden',
          config.podiumWidth,
          config.podiumHeight
        )}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.2, ease: 'easeOut' }}
        style={{ transformOrigin: 'bottom' }}
      >
        <div className={cn('absolute inset-0 bg-gradient-to-t', config.podiumGradient)} />
        {/* Holographic shimmer on podium */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Rank number inside podium */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/30 font-extrabold text-2xl sm:text-3xl md:text-4xl">{rank}</span>
        </div>
        {/* Neon top edge */}
        <motion.div
          className={cn('absolute top-0 left-0 right-0 h-px', rank === 1 ? 'bg-emerald-400' : rank === 2 ? 'bg-blue-400' : 'bg-amber-400')}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ boxShadow: `0 0 8px ${config.glowColor}` }}
        />
      </motion.div>
    </motion.div>
  );
}

export function TopThreePodium({ entries }: TopThreePodiumProps) {
  const [first, second, third] = entries;
  const confettiTriggered = useRef(false);

  const firstScore = useCountUp(Number(first?.total_score) || 0, 1400, 800);
  const secondScore = useCountUp(Number(second?.total_score) || 0, 1200, 600);
  const thirdScore = useCountUp(Number(third?.total_score) || 0, 1200, 700);

  useEffect(() => {
    if (first && !confettiTriggered.current) {
      confettiTriggered.current = true;
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#60a5fa'],
        });
      }, 900);
    }
  }, [first]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      role="region"
      aria-label="Top three leaderboard podium"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-950/90 to-gray-950" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scan line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 md:px-8 pt-10 sm:pt-12 md:pt-14 pb-0">
        {/* Podium entries — 2nd, 1st (elevated), 3rd */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 md:gap-8" role="list">
          {second && <PodiumEntry entry={second} rank={2} score={secondScore} delay={0.1} />}
          {first && <PodiumEntry entry={first} rank={1} score={firstScore} delay={0.2} />}
          {third && <PodiumEntry entry={third} rank={3} score={thirdScore} delay={0.3} />}
        </div>
      </div>

      {/* Bottom podium base line */}
      <div className="relative h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
