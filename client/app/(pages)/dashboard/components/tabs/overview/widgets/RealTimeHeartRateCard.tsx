'use client';

import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useMemo } from 'react';

interface HeartRateData {
  current: number | null;
  resting: number | null;
  max: number | null;
  zone: number;
  history: Array<{ time: string; bpm: number }>;
  lastUpdated: string | null;
}

interface RealTimeHeartRateCardProps {
  data: HeartRateData;
  isLoading?: boolean;
  isConnected?: boolean;
  showChart?: boolean;
}

// Max heart rate for progress calculation (220 - age, using 220 as max)
const MAX_HEART_RATE = 220;

// Size config matching CircularHealthMetric lg size
const CIRCLE_SIZE = 208;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2; // 98
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~615.75

export function RealTimeHeartRateCard({
  data,
  isLoading = false,
}: RealTimeHeartRateCardProps) {
  // Calculate progress percentage based on current HR relative to max
  const progress = useMemo(() => {
    if (!data.current) return 0;
    return Math.min(100, (data.current / MAX_HEART_RATE) * 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.current]);

  // Calculate stroke dashoffset for circular progress
  const strokeDashoffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  // Get color based on heart rate zone
  const getHeartRateColor = (hr: number | null) => {
    if (!hr) return { stroke: '#ef4444', text: 'text-red-400', glow: 'rgba(239, 68, 68, 0.3)' };
    if (hr < 100) return { stroke: '#ef4444', text: 'text-red-400', glow: 'rgba(239, 68, 68, 0.3)' };
    if (hr < 140) return { stroke: '#f97316', text: 'text-orange-400', glow: 'rgba(249, 115, 22, 0.3)' };
    return { stroke: '#ef4444', text: 'text-red-500', glow: 'rgba(239, 68, 68, 0.4)' };
  };

  const colors = getHeartRateColor(data.current);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex flex-col items-center justify-center"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Heart className="w-6 h-6 text-red-400/50 mb-4" />
        </motion.div>
        <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full bg-slate-800/30 animate-pulse" />
        <p className="mt-2 text-slate-400 text-xs">Loading...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="relative flex flex-col items-center justify-center"
    >
      {/* Icon Header */}
      <motion.div
        className="mb-1 sm:mb-2 opacity-90"
        animate={{ scale: data.current ? [1, 1.1, 1] : 1 }}
        transition={{ duration: data.current ? 60 / data.current : 1, repeat: Infinity }}
      >
        <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.text}`} fill="currentColor" />
      </motion.div>

      {/* Circular Progress - responsive sizing */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-44 lg:h-44">
        {/* Background Circle */}
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}>
          <circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke="rgba(239, 68, 68, 0.15)"
            strokeWidth={8}
            fill="url(#hr-bg-gradient)"
          />
          {/* Progress Circle */}
          <motion.circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={RADIUS}
            stroke={colors.stroke}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              strokeDasharray: CIRCUMFERENCE,
              filter: `drop-shadow(0 0 8px ${colors.glow})`,
            }}
          />
          {/* Gradient definitions */}
          <defs>
            <radialGradient id="hr-bg-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.05" />
            </radialGradient>
          </defs>
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          <motion.span
            className={`text-[16px] sm:text-[18px] md:text-xl lg:text-2xl font-bold ${colors.text} drop-shadow-2xl leading-tight`}
            style={{
              textShadow: `0 0 30px rgba(239, 68, 68, 0.5), 0 2px 4px rgba(0, 0, 0, 0.5)`,
              letterSpacing: '-0.02em',
            }}
            animate={data.current ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: data.current ? 60 / data.current : 1, repeat: Infinity }}
          >
            {data.current || '--'}
          </motion.span>
          <span className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-300/80">BPM</span>
          <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-red-400 mt-0.5">HEART RATE</span>
          {data.resting && (
            <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate max-w-full">Resting: {data.resting} bpm</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
