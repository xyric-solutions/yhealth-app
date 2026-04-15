'use client';

import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import { AnimatedProgressBar } from './AnimatedProgressBar';

interface ScoreBadgeProps {
  score: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'orange' | 'pink' | 'purple' | 'green';
}

export function ScoreBadge({ score, label, icon: Icon, color }: ScoreBadgeProps) {
  const colorClasses = {
    blue: {
      icon: 'text-blue-400',
      bg: 'from-blue-500/20 to-blue-600/20',
      border: 'border-blue-500/30',
      progress: 'from-blue-500 to-blue-600',
      text: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
    },
    orange: {
      icon: 'text-orange-400',
      bg: 'from-orange-500/20 to-orange-600/20',
      border: 'border-orange-500/30',
      progress: 'from-orange-500 to-orange-600',
      text: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
    },
    pink: {
      icon: 'text-pink-400',
      bg: 'from-pink-500/20 to-pink-600/20',
      border: 'border-pink-500/30',
      progress: 'from-pink-500 to-pink-600',
      text: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
    },
    purple: {
      icon: 'text-purple-400',
      bg: 'from-purple-500/20 to-purple-600/20',
      border: 'border-purple-500/30',
      progress: 'from-purple-500 to-purple-600',
      text: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
    },
    green: {
      icon: 'text-green-400',
      bg: 'from-green-500/20 to-green-600/20',
      border: 'border-green-500/30',
      progress: 'from-green-500 to-green-600',
      text: score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400',
    },
  };

  const classes = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.05, y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative bg-gradient-to-br ${classes.bg} backdrop-blur-xl rounded-2xl p-6 border-2 ${classes.border} overflow-hidden group`}
    >
      <motion.div
        className={`absolute -inset-1 bg-gradient-to-r ${classes.progress} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={`p-3 rounded-xl bg-white/5 ${classes.icon}`}
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-slate-400">{label}</p>
              <p className={`text-3xl font-bold ${classes.text} mt-1`}>
                <AnimatedNumber value={score} />
              </p>
            </div>
          </div>
        </div>
        <AnimatedProgressBar value={score} color={`bg-gradient-to-r ${classes.progress}`} delay={0.2} />
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </motion.div>
  );
}

