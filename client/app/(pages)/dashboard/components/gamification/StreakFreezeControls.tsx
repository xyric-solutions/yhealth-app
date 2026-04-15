'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Loader2, ShieldAlert, Coins } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface StreakFreezeControlsProps {
  freezesAvailable: number;
  currentStreak: number;
  totalXP: number;
  onPurchase: () => Promise<void>;
  onApply: (date?: string) => Promise<void>;
}

const MAX_FREEZES = 3;
const FREEZE_COST_XP = 200;

// ============================================
// CONFIRMATION DIALOG
// ============================================

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl bg-[#151520] border border-white/[0.08] p-4 shadow-2xl"
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <h4 id="confirm-title" className="text-sm font-semibold text-white mb-1">
        {title}
      </h4>
      <p id="confirm-desc" className="text-xs text-slate-400 mb-4">
        {message}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StreakFreezeControls({
  freezesAvailable,
  currentStreak,
  totalXP,
  onPurchase,
  onApply,
}: StreakFreezeControlsProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPurchase = totalXP >= FREEZE_COST_XP && freezesAvailable < MAX_FREEZES;
  const canApply = freezesAvailable > 0 && currentStreak === 0;

  const handlePurchase = useCallback(async () => {
    setError(null);
    setIsPurchasing(true);
    try {
      await onPurchase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  }, [onPurchase]);

  const handleApply = useCallback(async () => {
    setError(null);
    setIsApplying(true);
    try {
      await onApply();
      setShowApplyConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setIsApplying(false);
    }
  }, [onApply]);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Snowflake className="w-4 h-4 text-blue-400" />
          Streak Freezes
        </h3>
        <span className="text-[10px] text-slate-500 tabular-nums">
          {freezesAvailable}/{MAX_FREEZES} available
        </span>
      </div>

      {/* Freeze status indicators */}
      <div
        className="flex items-center gap-2 justify-center"
        role="group"
        aria-label={`${freezesAvailable} of ${MAX_FREEZES} streak freezes available`}
      >
        {Array.from({ length: MAX_FREEZES }, (_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, duration: 0.2 }}
            className={`flex items-center justify-center w-12 h-12 rounded-xl border transition-colors ${
              i < freezesAvailable
                ? 'bg-blue-500/15 border-blue-500/30'
                : 'bg-white/[0.02] border-white/[0.04]'
            }`}
          >
            <Snowflake
              className={`w-5 h-5 ${
                i < freezesAvailable ? 'text-blue-400' : 'text-slate-700'
              }`}
            />
          </motion.div>
        ))}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="space-y-2">
        {/* Buy Freeze button */}
        <button
          onClick={handlePurchase}
          disabled={!canPurchase || isPurchasing}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
            canPurchase
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-600/20'
              : 'bg-white/[0.04] text-slate-600 cursor-not-allowed border border-white/[0.04]'
          }`}
          aria-label={`Buy streak freeze for ${FREEZE_COST_XP} XP. ${
            !canPurchase
              ? totalXP < FREEZE_COST_XP
                ? 'Not enough XP'
                : 'Maximum freezes reached'
              : ''
          }`}
        >
          {isPurchasing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Coins className="w-3.5 h-3.5" />
              <span>Buy Freeze ({FREEZE_COST_XP} XP)</span>
            </>
          )}
        </button>

        {!canPurchase && !isPurchasing && (
          <p className="text-center text-[10px] text-slate-600">
            {totalXP < FREEZE_COST_XP
              ? `Need ${FREEZE_COST_XP - totalXP} more XP`
              : 'Maximum freezes reached'}
          </p>
        )}

        {/* Apply Freeze — only when streak is broken */}
        <AnimatePresence>
          {canApply && !showApplyConfirm && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => setShowApplyConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Snowflake className="w-3.5 h-3.5" />
              <span>Apply Freeze to Restore Streak</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Confirm dialog for apply */}
        <AnimatePresence>
          {showApplyConfirm && (
            <ConfirmDialog
              title="Apply Streak Freeze?"
              message="This will use one freeze to restore your streak from yesterday. This action cannot be undone."
              confirmLabel="Apply Freeze"
              onConfirm={handleApply}
              onCancel={() => setShowApplyConfirm(false)}
              isLoading={isApplying}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
