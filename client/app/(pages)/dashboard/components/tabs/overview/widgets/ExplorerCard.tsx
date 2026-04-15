'use client';

import { motion } from 'framer-motion';
import { Star, Trophy } from 'lucide-react';
import { useMemo } from 'react';

interface ExplorerCardProps {
  streakDays: number;
  xpCurrent: number;
  xpNextLevel: number;
  xpTotal: number;
  levelName: string;
  achievementCount: number;
  achievementTotal: number;
}

export function ExplorerCard({
  streakDays,
  xpCurrent,
  xpNextLevel,
  xpTotal,
  levelName,
  achievementCount,
  achievementTotal,
}: ExplorerCardProps) {
  const xpProgress = useMemo(() => {
    if (xpNextLevel <= 0) return 100;
    return Math.min((xpCurrent / xpNextLevel) * 100, 100);
  }, [xpCurrent, xpNextLevel]);

  const bonusPercentage = useMemo(() => {
    if (streakDays <= 0) return 0;
    return Math.min(Math.floor(streakDays / 5) + 1, 10);
  }, [streakDays]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative h-[200px] overflow-hidden rounded-2xl bg-[#0c0d1e] border border-white/[0.08] p-5 flex flex-col justify-between"
    >
      {/* Orange ambient glow behind streak area */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        }}
      />

      {/* Level badge — top right */}
      <div className="relative z-10 flex justify-end">
        <span className="px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">
          {levelName || 'CURRENT'}
        </span>
      </div>

      {/* Center content — streak icon + number */}
      <div className="relative z-10 flex flex-col items-center -mt-1">
        <img
          src="/overview/Streak.svg"
          alt="Streak flame"
          className="w-16 h-16 drop-shadow-[0_0_12px_rgba(251,146,60,0.4)]"
        />
        <p className="text-4xl font-bold text-white tabular-nums leading-none mt-1">
          {streakDays}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Day Streak</p>

        {/* XP summary */}
        <div className="flex items-center gap-1.5 mt-2">
          <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400 tabular-nums">
            {xpTotal.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* XP progress bar */}
      <div className="relative z-10 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">XP Progress</span>
          <span className="text-slate-400 tabular-nums">
            {xpCurrent}/{xpNextLevel}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
          />
        </div>

        {/* Bottom row — achievements + bonus */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-400 tabular-nums">
              {achievementCount}/{achievementTotal} achievements
            </span>
          </div>
          <span className="text-[10px] font-medium text-emerald-400 tabular-nums">
            +{bonusPercentage}% XP Bonus
          </span>
        </div>
      </div>
    </motion.div>
  );
}
