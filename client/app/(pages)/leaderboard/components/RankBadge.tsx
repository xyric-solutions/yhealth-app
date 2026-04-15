'use client';

import { motion } from 'framer-motion';
import { Crown, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankBadgeProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function RankBadge({ rank, size = 'md', showIcon = true, className }: RankBadgeProps) {
  const isTopTen = rank <= 10;
  const isTopThree = rank <= 3;

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const getRankIcon = () => {
    if (!showIcon) return null;
    
    switch (rank) {
      case 1:
        return <Crown className={cn('text-yellow-400', iconSizes[size])} />;
      case 2:
        return <Medal className={cn('text-gray-300', iconSizes[size])} />;
      case 3:
        return <Award className={cn('text-amber-600', iconSizes[size])} />;
      default:
        return null;
    }
  };

  const getRankStyles = () => {
    if (rank === 1) {
      return 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border-yellow-500/50 text-yellow-400';
    }
    if (rank === 2) {
      return 'bg-gradient-to-br from-gray-400/30 to-gray-500/20 border-gray-400/50 text-gray-300';
    }
    if (rank === 3) {
      return 'bg-gradient-to-br from-amber-500/30 to-amber-600/20 border-amber-500/50 text-amber-400';
    }
    if (isTopTen) {
      return 'bg-gradient-to-br from-purple-500/30 to-pink-500/20 border-purple-500/50 text-purple-300';
    }
    return 'bg-white/10 border-white/20 text-gray-400';
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      whileHover={{ scale: 1.1 }}
      className={cn(
        'relative flex items-center justify-center rounded-full border-2 font-bold shadow-lg',
        sizeClasses[size],
        getRankStyles(),
        className
      )}
    >
      {isTopThree && showIcon && (
        <motion.div
          className="absolute -top-1 -right-1"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {getRankIcon()}
        </motion.div>
      )}
      <span className="relative z-10">#{rank}</span>
      
      {/* Glow effect for top ranks */}
      {isTopTen && (
        <motion.div
          className="absolute inset-0 rounded-full blur-md"
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background: rank === 1
              ? 'radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)',
          }}
        />
      )}
    </motion.div>
  );
}

