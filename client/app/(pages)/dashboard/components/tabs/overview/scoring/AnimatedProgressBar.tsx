'use client';

import { motion } from 'framer-motion';

interface AnimatedProgressBarProps {
  value: number;
  color: string;
  delay?: number;
  height?: string;
}

export function AnimatedProgressBar({
  value,
  color,
  delay = 0,
  height = 'h-2',
}: AnimatedProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={`relative ${height} bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedValue}%` }}
        transition={{
          duration: 1.5,
          delay,
          ease: [0.4, 0, 0.2, 1],
        }}
        className={`h-full rounded-full ${color} relative`}
      >
        <motion.div
          className="absolute inset-0 bg-white/20"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>
    </div>
  );
}

