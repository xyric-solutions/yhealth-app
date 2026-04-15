'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Plus, Minus, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api-client';

interface WaterLog {
  id: string;
  userId: string;
  logDate: string;
  glassesConsumed: number;
  targetGlasses: number;
  mlConsumed: number;
  targetMl: number;
  goalAchieved: boolean;
  xpEarned: number;
}

// ============================================
// SKELETON LOADER
// ============================================

function WaterSkeleton() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(145deg, #0f0f1a 0%, #0a0a14 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="h-6 w-32 rounded bg-white/[0.04] animate-pulse mb-3" />
      <div className="h-2 rounded-full bg-white/[0.04] animate-pulse mb-4" />
      <div className="flex gap-1.5 mb-4 justify-center">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-6 h-6 rounded bg-white/[0.04] animate-pulse" />
        ))}
      </div>
      <div className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
    </div>
  );
}

// ============================================
// 3D REALISTIC GLASS WITH ANIMATED WATER
// ============================================

function GlassIcon({ filled, index }: { filled: boolean; index: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 350, damping: 20 }}
      className="flex items-center justify-center"
    >
      <svg viewBox="0 0 36 52" className="w-7 h-10 sm:w-8 sm:h-11" style={{ filter: filled ? 'drop-shadow(0 2px 6px rgba(6,182,212,0.35))' : 'none' }}>
        <defs>
          {/* Glass body gradient — transparent with subtle reflections */}
          <linearGradient id={`glass-body-${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="80%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>

          {/* Water gradient — realistic blue with depth */}
          <linearGradient id={`water-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
            <stop offset="30%" stopColor="#06b6d4" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#0891b2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0e7490" stopOpacity="0.95" />
          </linearGradient>

          {/* Water surface highlight */}
          <linearGradient id={`water-surface-${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Clip path for water inside glass shape */}
          <clipPath id={`glass-clip-${index}`}>
            <path d="M7 8 L5 44 Q5 48 9 48 L27 48 Q31 48 31 44 L29 8 Z" />
          </clipPath>
        </defs>

        {/* Glass body — tapered transparent shape */}
        <path
          d="M7 8 L5 44 Q5 48 9 48 L27 48 Q31 48 31 44 L29 8 Z"
          fill={`url(#glass-body-${index})`}
          stroke={filled ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.08)'}
          strokeWidth="1"
        />

        {/* Water fill — clipped to glass shape */}
        {filled && (
          <g clipPath={`url(#glass-clip-${index})`}>
            {/* Main water body — rises from bottom */}
            <motion.rect
              x="4" width="28" height="38"
              fill={`url(#water-fill-${index})`}
              initial={{ y: 48 }}
              animate={{ y: 12 }}
              transition={{ duration: 0.8, delay: index * 0.06 + 0.15, ease: [0.34, 1.56, 0.64, 1] }}
            />

            {/* Water surface wave — animated sine wave */}
            <motion.path
              fill={`url(#water-surface-${index})`}
              initial={{ d: 'M4 20 Q12 20 18 20 Q24 20 32 20 L32 23 L4 23 Z', opacity: 0 }}
              animate={{
                d: [
                  'M4 14 Q10 11 18 14 Q26 17 32 14 L32 17 L4 17 Z',
                  'M4 14 Q10 17 18 13 Q26 10 32 14 L32 17 L4 17 Z',
                  'M4 14 Q10 11 18 14 Q26 17 32 14 L32 17 L4 17 Z',
                ],
                opacity: 1,
              }}
              transition={{
                d: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 },
                opacity: { duration: 0.5, delay: index * 0.06 + 0.6 },
              }}
            />

            {/* Bubbles — small rising circles */}
            <motion.circle
              cx={14 + index % 3 * 4} r="1"
              fill="rgba(255,255,255,0.3)"
              initial={{ cy: 44, opacity: 0 }}
              animate={{ cy: [44, 20], opacity: [0, 0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 + 1, ease: 'easeOut' }}
            />
            <motion.circle
              cx={20 + index % 2 * 3} r="0.7"
              fill="rgba(255,255,255,0.2)"
              initial={{ cy: 40, opacity: 0 }}
              animate={{ cy: [40, 18], opacity: [0, 0.4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.4 + 1.5, ease: 'easeOut' }}
            />
          </g>
        )}

        {/* Glass rim — thick top edge */}
        <rect x="6" y="5" width="24" height="4" rx="2"
          fill={filled ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)'}
          stroke={filled ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)'}
          strokeWidth="0.5"
        />

        {/* Left edge reflection — vertical highlight for 3D effect */}
        <path
          d="M9 10 L7.5 42"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Right subtle reflection */}
        <path
          d="M27 12 L28.5 38"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Bottom refraction glow when filled */}
        {filled && (
          <ellipse cx="18" cy="46" rx="8" ry="1.5"
            fill="rgba(6,182,212,0.15)"
          />
        )}
      </svg>
    </motion.div>
  );
}

// ============================================
// MAIN WIDGET
// ============================================

export function WaterIntakeWidget() {
  const [waterLog, setWaterLog] = useState<WaterLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const fetchWaterLog = useCallback(async () => {
    try {
      const response = await api.get<{ log: WaterLog }>('/water/today');
      if (response.success && response.data) {
        // Handle both: { log: WaterLog } and direct WaterLog shape
        const logData = response.data.log ?? (response.data as unknown as WaterLog);
        if (logData && typeof logData.glassesConsumed === 'number') {
          setWaterLog(logData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch water log:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaterLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - request deduplication handles concurrent calls

  const handleAddGlass = async () => {
    setIsUpdating(true);
    try {
      const wasGoalAchieved = waterLog?.goalAchieved ?? false;
      const response = await api.post<{ log: WaterLog }>('/water/add-glass');

      // Handle both response shapes: { data: { log } } or { data: { log } } where data might be nested
      const logData = response?.data?.log ?? (response?.data as unknown as WaterLog);

      if (response.success && logData) {
        setWaterLog(logData);

        // Dispatch event for other components (like UnifiedHealthDashboard)
        window.dispatchEvent(new CustomEvent('water-intake-updated'));

        // Show celebration if goal just achieved
        if (!wasGoalAchieved && logData.goalAchieved) {
          setJustCompleted(true);
          setTimeout(() => setJustCompleted(false), 3000);
        }
      } else {
        // Fallback: refetch to get latest state
        await fetchWaterLog();
      }
    } catch (err) {
      console.error('Failed to add water:', err);
      // Refetch on error to sync state
      await fetchWaterLog();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveGlass = async () => {
    if (!waterLog || waterLog.glassesConsumed <= 0) return;

    setIsUpdating(true);
    try {
      const response = await api.post<{ log: WaterLog }>('/water/remove', {
        amountMl: 250,
      });
      const logData = response?.data?.log ?? (response?.data as unknown as WaterLog);
      if (response.success && logData) {
        setWaterLog(logData);
      } else {
        await fetchWaterLog();
      }
    } catch (err) {
      console.error('Failed to remove water:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <WaterSkeleton />;
  }

  const glasses = waterLog?.glassesConsumed ?? 0;
  const target = waterLog?.targetGlasses ?? 8;
  const progress = Math.min((glasses / target) * 100, 100);
  const goalAchieved = waterLog?.goalAchieved ?? false;
  const mlConsumed = waterLog?.mlConsumed ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(145deg, #0f0f1a 0%, #0a0a14 100%)',
        border: goalAchieved
          ? '1px solid rgba(6,182,212,0.3)'
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: goalAchieved ? '0 0 24px rgba(6,182,212,0.08)' : 'none',
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
      }}
    >
      {/* Ambient glow for achieved state */}
      {goalAchieved && (
        <div
          className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(6,182,212,0.08)' }}
        />
      )}

      {/* Goal achieved celebration overlay */}
      <AnimatePresence>
        {justCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-10 rounded-2xl"
            style={{
              background: 'rgba(6,182,212,0.12)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 10 }}
                className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  boxShadow: '0 0 30px rgba(16,185,129,0.4)',
                }}
              >
                <Check className="w-7 h-7 text-white" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-emerald-400 font-semibold text-sm"
              >
                Water Goal Achieved!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-emerald-400/60 text-xs mt-0.5"
              >
                +10 XP
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative p-4 sm:p-5">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: goalAchieved ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.15)',
              }}
            >
              <Droplets className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">Water Intake</span>
          </div>
          {goalAchieved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(6,182,212,0.12)',
                color: '#22d3ee',
                border: '1px solid rgba(6,182,212,0.2)',
              }}
            >
              Goal Met
            </motion.span>
          )}
        </div>

        {/* ---- Stats row: glasses count + ml ---- */}
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-baseline gap-1">
            <motion.span
              key={glasses}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-white tabular-nums"
            >
              {glasses}
            </motion.span>
            <span className="text-sm text-slate-500 font-medium">/ {target} glasses</span>
          </div>
          <span className="text-xs text-slate-600 tabular-nums font-medium">
            {mlConsumed.toLocaleString()} ml
          </span>
        </div>

        {/* ---- Progress bar ---- */}
        <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: goalAchieved
                ? 'linear-gradient(90deg, #06b6d4, #10b981)'
                : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
              boxShadow: `0 0 10px rgba(6,182,212,0.4), 0 0 4px rgba(6,182,212,0.3)`,
            }}
          >
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 1 }}
            />
          </motion.div>
        </div>

        {/* ---- Glass indicators ---- */}
        <div className="flex gap-1.5 sm:gap-2 mb-4 justify-center">
          {Array.from({ length: target }).map((_, i) => (
            <GlassIcon key={i} filled={i < glasses} index={i} />
          ))}
        </div>

        {/* ---- Action buttons ---- */}
        <div className="flex items-center gap-2.5">
          {/* Minus button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleRemoveGlass}
            disabled={isUpdating || glasses <= 0}
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            aria-label="Remove one glass of water"
          >
            <Minus className="w-4 h-4 text-slate-400" />
          </motion.button>

          {/* Add Glass button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAddGlass}
            disabled={isUpdating}
            className="flex-1 h-10 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:cursor-not-allowed"
            style={{
              background: isUpdating
                ? 'rgba(6,182,212,0.3)'
                : 'linear-gradient(135deg, #06b6d4, #0284c7)',
              boxShadow: isUpdating ? 'none' : '0 4px 16px rgba(6,182,212,0.25)',
              border: '1px solid rgba(6,182,212,0.3)',
            }}
            aria-label="Add one glass of water"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin text-white/70" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Glass</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
