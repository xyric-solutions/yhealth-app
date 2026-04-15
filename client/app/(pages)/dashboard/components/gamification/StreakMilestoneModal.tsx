'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Snowflake, Sparkles, X } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface MilestoneData {
  days: number;
  tierName: string;
  xpBonus: number;
  freezesEarned: number;
  titleUnlocked: string | null;
  badgeIcon: string;
}

interface StreakMilestoneModalProps {
  milestone: MilestoneData | null;
  onDismiss: () => void;
}

// ============================================
// TIER COLORS (same mapping as StreakWidget)
// ============================================

function getTierColor(tierName: string): { text: string; glow: string; gradient: string } {
  const lower = tierName.toLowerCase();
  switch (lower) {
    case 'spark':
      return { text: 'text-slate-300', glow: '', gradient: 'from-slate-400 to-slate-300' };
    case 'flame':
      return { text: 'text-blue-400', glow: 'drop-shadow-[0_0_16px_rgba(96,165,250,0.5)]', gradient: 'from-blue-500 to-blue-400' };
    case 'blaze':
      return { text: 'text-purple-400', glow: 'drop-shadow-[0_0_16px_rgba(192,132,252,0.5)]', gradient: 'from-purple-500 to-purple-400' };
    case 'inferno':
      return { text: 'text-orange-400', glow: 'drop-shadow-[0_0_16px_rgba(251,146,60,0.5)]', gradient: 'from-orange-500 to-orange-400' };
    case 'wildfire':
      return { text: 'text-amber-400', glow: 'drop-shadow-[0_0_16px_rgba(251,191,36,0.5)]', gradient: 'from-amber-500 to-amber-400' };
    case 'supernova':
      return { text: 'text-yellow-300', glow: 'drop-shadow-[0_0_24px_rgba(253,224,71,0.6)]', gradient: 'from-yellow-400 to-amber-300' };
    default:
      return { text: 'text-white', glow: '', gradient: 'from-slate-400 to-slate-300' };
  }
}

// ============================================
// BADGE ICON RENDERER
// ============================================

function BadgeIcon({ icon, tierColor }: { icon: string; tierColor: { text: string; glow: string } }) {
  // Render the badge icon as an emoji if it looks like one, otherwise use Flame as fallback
  const isEmoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(icon);

  if (isEmoji) {
    return (
      <span className={`text-6xl ${tierColor.glow}`} role="img" aria-label="milestone badge">
        {icon}
      </span>
    );
  }

  return <Flame className={`w-16 h-16 ${tierColor.text} ${tierColor.glow} fill-current`} />;
}

// ============================================
// REWARD ITEM
// ============================================

function RewardItem({
  icon,
  label,
  index,
  fromSide,
}: {
  icon: React.ReactNode;
  label: string;
  index: number;
  fromSide: 'left' | 'right';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: fromSide === 'left' ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: 0.8 + index * 0.15,
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08]"
    >
      {icon}
      <span className="text-sm text-white font-medium">{label}</span>
    </motion.div>
  );
}

// ============================================
// MAIN MODAL
// ============================================

const AUTO_DISMISS_MS = 8000;

export function StreakMilestoneModal({ milestone, onDismiss }: StreakMilestoneModalProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (milestone) {
      clearAutoTimer();
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, AUTO_DISMISS_MS);
    }
    return clearAutoTimer;
  }, [milestone, onDismiss, clearAutoTimer]);

  // Close on Escape
  useEffect(() => {
    if (!milestone) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [milestone, onDismiss]);

  const tierColor = milestone ? getTierColor(milestone.tierName) : getTierColor('');

  // Build rewards list
  const rewards: { icon: React.ReactNode; label: string }[] = [];
  if (milestone) {
    if (milestone.xpBonus > 0) {
      rewards.push({
        icon: <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />,
        label: `+${milestone.xpBonus.toLocaleString()} XP`,
      });
    }
    if (milestone.freezesEarned > 0) {
      rewards.push({
        icon: <Snowflake className="w-4 h-4 text-blue-400 shrink-0" />,
        label: `+${milestone.freezesEarned} Streak Freeze${milestone.freezesEarned > 1 ? 's' : ''}`,
      });
    }
    if (milestone.titleUnlocked) {
      rewards.push({
        icon: <Flame className="w-4 h-4 text-orange-400 shrink-0" />,
        label: `Title: ${milestone.titleUnlocked}`,
      });
    }
  }

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-label={`Streak milestone: ${milestone.tierName}`}
        >
          {/* Prevent click-through to overlay for inner content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="relative flex flex-col items-center text-center max-w-sm w-full mx-4 p-8 rounded-3xl bg-gradient-to-b from-[#12121f] to-[#08080e] border border-white/[0.08] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.06] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Badge icon with scale animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 10,
              }}
              className="mb-6"
            >
              <BadgeIcon icon={milestone.badgeIcon} tierColor={tierColor} />
            </motion.div>

            {/* Tier name */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className={`text-2xl font-bold mb-1 ${tierColor.text} ${tierColor.glow}`}
            >
              {milestone.tierName}
            </motion.h2>

            {/* Streak day count */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="text-4xl font-extrabold text-white mb-1 tabular-nums"
            >
              {milestone.days}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.3 }}
              className="text-sm text-slate-500 mb-6"
            >
              Day Streak
            </motion.p>

            {/* Rewards list */}
            {rewards.length > 0 && (
              <div className="w-full space-y-2 mb-6">
                {rewards.map((reward, i) => (
                  <RewardItem
                    key={i}
                    icon={reward.icon}
                    label={reward.label}
                    index={i}
                    fromSide={i % 2 === 0 ? 'left' : 'right'}
                  />
                ))}
              </div>
            )}

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 + rewards.length * 0.15, duration: 0.3 }}
              onClick={onDismiss}
              className={`w-full px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${tierColor.gradient} hover:opacity-90 transition-opacity shadow-lg`}
            >
              Continue
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
