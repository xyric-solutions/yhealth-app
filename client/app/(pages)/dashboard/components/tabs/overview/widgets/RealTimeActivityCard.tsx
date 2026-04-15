'use client';

import { motion } from 'framer-motion';
import { Footprints, Flame, Activity, Zap, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ActivityData {
  steps: number | null;
  target: number;
  strain: {
    score: number | null; // 0-21 scale
    normalized: number | null; // 0-100 scale
    calories: number | null;
  } | null;
}

interface RealTimeActivityCardProps {
  data: ActivityData;
  isLoading?: boolean;
  showStrainAlternative?: boolean;
}

const STRAIN_LEVELS = [
  { min: 0, max: 5, label: 'Light', color: 'from-blue-500 to-cyan-500', textColor: 'text-blue-400' },
  { min: 5, max: 10, label: 'Moderate', color: 'from-green-500 to-emerald-500', textColor: 'text-green-400' },
  { min: 10, max: 15, label: 'Strenuous', color: 'from-yellow-500 to-orange-500', textColor: 'text-yellow-400' },
  { min: 15, max: 18, label: 'High', color: 'from-orange-500 to-red-500', textColor: 'text-orange-400' },
  { min: 18, max: 21, label: 'Extreme', color: 'from-red-500 to-rose-600', textColor: 'text-red-400' },
];

function getStrainLevel(score: number) {
  for (const level of STRAIN_LEVELS) {
    if (score >= level.min && score < level.max) return level;
  }
  return STRAIN_LEVELS[STRAIN_LEVELS.length - 1];
}

export function RealTimeActivityCard({
  data,
  isLoading = false,
  showStrainAlternative = true,
}: RealTimeActivityCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  const stepsProgress = useMemo(() => {
    if (!data.steps) return 0;
    return Math.min(100, (data.steps / data.target) * 100);
  }, [data.steps, data.target]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const strainLevel = useMemo(() => {
    if (!data.strain?.score) return null;
    return getStrainLevel(data.strain.score);
  }, [data.strain?.score]);

  const hasSteps = data.steps !== null && data.steps > 0;
  const hasStrain = data.strain !== null && data.strain.score !== null && data.strain.score !== undefined;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 border border-slate-700/50"
      >
        <div className="flex flex-col items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Activity className="w-12 h-12 text-emerald-400/50" />
          </motion.div>
          <p className="mt-4 text-slate-400">Loading activity data...</p>
        </div>
      </motion.div>
    );
  }

  // Show Steps if available, otherwise show Strain from Whoop
  if (hasSteps) {
    const remaining = Math.max(0, data.target - data.steps!);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/30"
        style={{
          boxShadow: '0 0 60px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30">
                <Footprints className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Daily Steps</h3>
                <p className="text-xs text-slate-400">Today&apos;s activity</p>
              </div>
            </div>
          </div>

          {/* Main Value */}
          <div className="text-center mb-6">
            <motion.span
              className="text-2xl sm:text-3xl font-black text-white"
              style={{ textShadow: '0 0 30px rgba(16, 185, 129, 0.5)' }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              {data.steps!.toLocaleString()}
            </motion.span>
            <p className="text-slate-400 mt-1">
              Target: {data.target.toLocaleString()}
            </p>
          </div>

          {/* Progress Ring */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="rgba(16, 185, 129, 0.1)"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                stroke="url(#stepsGradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: '0 283' }}
                animate={{ strokeDasharray: `${(stepsProgress / 100) * 283} 283` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="stepsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-emerald-400">{Math.round(stepsProgress)}%</span>
              <span className="text-xs text-slate-400">Complete</span>
            </div>
          </div>

          {/* Remaining */}
          {remaining > 0 && (
            <div className="text-center">
              <p className="text-sm text-slate-400">
                <span className="text-emerald-400 font-semibold">{remaining.toLocaleString()}</span> steps to go
              </p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Show Strain from Whoop as alternative
  if (hasStrain && showStrainAlternative) {
    const strainScore = data.strain!.score!;
    const normalizedStrain = data.strain!.normalized || (strainScore / 21) * 100;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-orange-500/30`}
        style={{
          boxShadow: '0 0 60px rgba(249, 115, 22, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-3 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/30"
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(249, 115, 22, 0)',
                    '0 0 15px 5px rgba(249, 115, 22, 0.2)',
                    '0 0 0 0 rgba(249, 115, 22, 0)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="w-6 h-6 text-orange-400" />
              </motion.div>
              <div>
                <h3 className="text-lg font-bold text-white">Daily Strain</h3>
                <p className="text-xs text-slate-400">From Whoop</p>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Info className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Info Tooltip */}
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-xs text-slate-300"
            >
              <p className="mb-2">
                <strong>Whoop Strain</strong> measures your cardiovascular load on a 0-21 scale.
              </p>
              <p className="text-slate-400">
                Steps are not tracked by Whoop. Connect Apple Health or Google Fit for step counting.
              </p>
            </motion.div>
          )}

          {/* Main Value */}
          <div className="text-center mb-6">
            <motion.span
              className="text-2xl sm:text-3xl font-black text-white"
              style={{ textShadow: '0 0 30px rgba(249, 115, 22, 0.5)' }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              {strainScore.toFixed(1)}
            </motion.span>
            <p className="text-slate-400 mt-1">/ 21.0 max strain</p>
          </div>

          {/* Strain Level Badge */}
          {strainLevel && (
            <div className="flex justify-center mb-6">
              <motion.div
                className={`px-4 py-2 rounded-xl bg-gradient-to-r ${strainLevel.color} border border-white/10`}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
              >
                <span className="text-sm font-semibold text-white">
                  {strainLevel.label} Activity
                </span>
              </motion.div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400">Daily strain progress</span>
              <span className={strainLevel?.textColor || 'text-orange-400'}>
                {Math.round(normalizedStrain)}%
              </span>
            </div>
            <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${normalizedStrain}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Calories */}
          {data.strain?.calories && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-slate-300">
                <span className="text-orange-400 font-semibold">
                  {data.strain.calories.toLocaleString()}
                </span>
                {' '}kcal burned
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // No data available
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 border border-slate-700/50"
    >
      <div className="flex flex-col items-center justify-center h-64">
        <div className="p-4 rounded-full bg-slate-800/50 mb-4">
          <Footprints className="w-10 h-10 text-slate-500" />
        </div>
        <p className="text-slate-300 font-medium mb-2">No Activity Data</p>
        <p className="text-sm text-slate-500 text-center max-w-xs">
          Connect Whoop for strain tracking or Apple Health/Google Fit for step counting
        </p>
      </div>
    </motion.div>
  );
}
