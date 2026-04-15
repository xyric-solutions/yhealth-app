'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  Users,
  Award,
  Video,
  MessageCircle,
  BarChart3,
  Heart,
  ThumbsUp,
  Flame,
  Star,
  Clock,
  Target,
  Shield,
  Zap,
  X,
} from 'lucide-react';
import type {
  Competition,
  CompetitionEntry,
  LeaderboardResponse,
} from '@/src/shared/services/leaderboard.service';
import { getCompetitionLeaderboard } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LeaderboardList } from '@/components/features/competitions';
import { CompetitionLiveChat } from './CompetitionLiveChat';
import { CameraStreamPlaceholder } from './CameraStreamPlaceholder';
import { GoLiveButton } from './GoLiveButton';
import { StreamControls } from './StreamControls';
import { useLeaderboardSocket } from '@/hooks/use-leaderboard-socket';
import { useVideoRoom } from '@/hooks/use-competition-streams';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'leaderboard' | 'chat' | 'streams' | 'details';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CompetitionDetailViewProps {
  competition: Competition;
  userEntry?: CompetitionEntry | null;
  currentUserId?: string;
  onJoin?: (competitionId: string) => void;
  onLeave?: (competitionId: string) => void;
  onClose?: () => void;
}

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: TabDefinition[] = [
  { id: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
  { id: 'chat', label: 'Live Chat', icon: MessageCircle },
  { id: 'streams', label: 'Live Streams', icon: Video },
  { id: 'details', label: 'Details', icon: Target },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  draft: { label: 'Draft', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/30' },
  ended: { label: 'Ended', color: 'text-gray-400', bg: 'bg-gray-500/20 border-gray-500/30' },
};


const SCORING_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  workout: { label: 'Workout', icon: Flame, color: 'from-orange-500 to-red-500' },
  nutrition: { label: 'Nutrition', icon: Heart, color: 'from-green-500 to-emerald-500' },
  wellbeing: { label: 'Wellbeing', icon: Star, color: 'from-purple-500 to-violet-500' },
  biometrics: { label: 'Biometrics', icon: Zap, color: 'from-pink-500 to-rose-500' },
  engagement: { label: 'Engagement', icon: ThumbsUp, color: 'from-blue-500 to-indigo-500' },
  consistency: { label: 'Consistency', icon: Target, color: 'from-amber-500 to-yellow-500' },
};

// ---------------------------------------------------------------------------
// Utility hooks
// ---------------------------------------------------------------------------

function useCountdown(endDateStr: string): CountdownValues {
  const computeValues = useCallback((): CountdownValues => {
    const now = Date.now();
    const end = new Date(endDateStr).getTime();
    const diff = Math.max(0, end - now);

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [endDateStr]);

  const [countdown, setCountdown] = useState<CountdownValues>(computeValues);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(computeValues());
    }, 1000);
    return () => clearInterval(interval);
  }, [computeValues]);

  return countdown;
}

function useAnimatedCounter(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(0);
      return;
    }

    let start = 0;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * target);
      setValue(start);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [target, duration]);

  return value;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single animated digit in the countdown timer */
function CountdownDigit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex gap-0.5">
        {display.split('').map((digit, i) => (
          <div
            key={`${label}-${i}`}
            className="relative w-8 h-10 sm:w-10 sm:h-12 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg overflow-hidden"
          >
            <AnimatePresence mode="popLayout">
              <motion.span
                key={`${digit}-${label}-${i}`}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute inset-0 flex items-center justify-center text-lg sm:text-xl font-bold text-white tabular-nums"
              >
                {digit}
              </motion.span>
            </AnimatePresence>
          </div>
        ))}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

/** Colon separator between countdown digit groups */
function CountdownSeparator() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      className="text-xl sm:text-2xl font-bold text-emerald-400 self-start mt-2 sm:mt-2.5"
    >
      :
    </motion.span>
  );
}

/** Competition progress bar (start to end date) */
function CompetitionProgress({ startDate, endDate }: { startDate: string; endDate: string }) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const total = end - start;
  // eslint-disable-next-line react-hooks/purity -- stable timestamp captured once per mount
  const nowRef = useRef(Date.now());
  const elapsed = nowRef.current - start;
  const p = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  const percentage = Math.round(p * 100);

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Progress</span>
        <span className="tabular-nums">{percentage}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-emerald-500 to-cyan-500"
        />
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-y-0 w-16 bg-linear-to-r from-transparent via-white/20 to-transparent"
          animate={{ left: ['-10%', '110%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
        />
      </div>
    </div>
  );
}

/** Animated rank badge */
function RankBadge({ rank }: { rank: number | null }) {
  const displayRank = rank ?? 0;
  const animatedRank = useAnimatedCounter(displayRank, 800);

  if (!rank) {
    return (
      <div className="flex items-center gap-1.5 text-gray-500">
        <Trophy className="w-5 h-5" />
        <span className="text-sm font-medium">Unranked</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-linear-to-br from-emerald-500/30 to-cyan-500/30 backdrop-blur-xl border border-emerald-500/40 flex items-center justify-center">
            <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
              {animatedRank}
            </span>
          </div>
          {/* Glow ring */}
          <motion.div
            className="absolute -inset-1 rounded-2xl bg-linear-to-br from-emerald-500/20 to-cyan-500/20 -z-10"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">
          Your Rank
        </span>
      </div>
    </motion.div>
  );
}

/** Mini avatar stack showing participants */
function ParticipantAvatarStack({
  count,
  avatars,
}: {
  count: number;
  avatars: Array<{ name: string; avatar?: string }>;
}) {
  const animatedCount = useAnimatedCounter(count, 1000);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {avatars.slice(0, 5).map((participant, i) => (
          <motion.div
            key={participant.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Avatar className="w-7 h-7 border-2 border-gray-900 ring-1 ring-white/10">
              <AvatarImage src={participant.avatar} alt={participant.name} />
              <AvatarFallback className="bg-linear-to-br from-emerald-600 to-cyan-600 text-white text-[10px] font-bold">
                {participant.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-white tabular-nums">
          {animatedCount.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500 hidden sm:inline">joined</span>
      </div>
    </div>
  );
}

function generateConfettiParticles() {
  const colors = ['bg-emerald-400', 'bg-cyan-400', 'bg-yellow-400', 'bg-pink-400', 'bg-violet-400', 'bg-orange-400'];
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: -(Math.random() * 200 + 50),
    rotation: Math.random() * 360,
    scale: Math.random() * 0.5 + 0.5,
    color: colors[Math.floor(Math.random() * 6)],
  }));
}

/** Confetti particles on join */
function JoinConfetti({ isPlaying }: { isPlaying: boolean }) {
  const [particles] = useState(generateConfettiParticles);

  if (!isPlaying) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-50" aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: '50%',
            y: '50%',
            scale: 0,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            x: `calc(50% + ${p.x}px)`,
            y: `calc(50% + ${p.y}px)`,
            scale: p.scale,
            rotate: p.rotation,
            opacity: 0,
          }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className={cn('absolute w-2 h-2 rounded-full', p.color)}
        />
      ))}
    </div>
  );
}

/** Leave confirmation modal */
function LeaveConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  competitionName,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  competitionName: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
          aria-label="Leave competition confirmation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-md backdrop-blur-xl bg-gray-900/90 border border-white/10 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Leave Competition?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to leave{' '}
              <span className="text-white font-medium">{competitionName}</span>? Your progress and
              rank will be lost. You can rejoin later if the competition is still active.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1 border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Leave Competition
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Scoring weight bar for the Details tab */
function ScoringBar({
  label,
  value,
  maxValue,
  gradientClass,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number;
  maxValue: number;
  gradientClass: string;
  icon: React.ComponentType<{ className?: string }>;
  delay: number;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">{label}</span>
        </div>
        <span className="text-sm font-bold text-white tabular-nums">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
          className={cn('h-full rounded-full bg-linear-to-r', gradientClass)}
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Details Tab
// ---------------------------------------------------------------------------

function DetailsTabContent({ competition }: { competition: Competition }) {
  const rules = competition.rules as Record<string, unknown>;
  const scoring = competition.scoring_weights;
  const prizes = competition.prize_metadata;
  const maxWeight = scoring
    ? Math.max(...Object.values(scoring).filter((v): v is number => typeof v === 'number'))
    : 100;

  const staggerItem = {
    hidden: { opacity: 0, y: 12 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08 },
    }),
  };

  // eslint-disable-next-line react-hooks/purity -- stable timestamp captured once per mount
  const nowRef = useRef(Date.now());
  const milestones = useMemo(() => {
    const startDate = new Date(competition.start_date);
    const endDate = new Date(competition.end_date);
    const now = nowRef.current;
    return [
      {
        label: 'Competition Start',
        date: startDate,
        icon: Zap,
        active: now >= startDate.getTime(),
      },
      {
        label: 'Midpoint',
        date: new Date((startDate.getTime() + endDate.getTime()) / 2),
        icon: Clock,
        active: now >= (startDate.getTime() + endDate.getTime()) / 2,
      },
      {
        label: 'Competition End',
        date: endDate,
        icon: Trophy,
        active: now >= endDate.getTime(),
      },
    ];
  }, [competition.start_date, competition.end_date]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Rules */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Competition Rules</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            custom={0}
            variants={staggerItem}
            initial="hidden"
            animate="show"
            className="bg-white/5 rounded-xl p-4 border border-white/5"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Metric</p>
            <p className="text-sm font-semibold text-white capitalize">
              {String(rules?.metric ?? 'Total Score')}
            </p>
          </motion.div>
          <motion.div
            custom={1}
            variants={staggerItem}
            initial="hidden"
            animate="show"
            className="bg-white/5 rounded-xl p-4 border border-white/5"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Aggregation</p>
            <p className="text-sm font-semibold text-white capitalize">
              {String(rules?.aggregation ?? 'Sum')}
            </p>
          </motion.div>
          {rules?.target != null && (
            <motion.div
              custom={2}
              variants={staggerItem}
              initial="hidden"
              animate="show"
              className="bg-white/5 rounded-xl p-4 border border-white/5"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Target</p>
              <p className="text-sm font-semibold text-emerald-400">{String(rules.target)}</p>
            </motion.div>
          )}
          {rules?.min_days != null && (
            <motion.div
              custom={3}
              variants={staggerItem}
              initial="hidden"
              animate="show"
              className="bg-white/5 rounded-xl p-4 border border-white/5"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Min Days</p>
              <p className="text-sm font-semibold text-white">{String(rules.min_days)} days</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scoring Weights */}
      {scoring && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Scoring Breakdown</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(SCORING_LABELS).map(([key, config], i) => {
              const weight = scoring[key as keyof typeof scoring];
              if (weight == null) return null;
              return (
                <ScoringBar
                  key={key}
                  label={config.label}
                  value={weight}
                  maxValue={maxWeight}
                  gradientClass={config.color}
                  icon={config.icon}
                  delay={i * 0.1}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Prizes */}
      {prizes && (prizes.badges?.length || prizes.rewards?.length) && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-yellow-400" />
            <h3 className="text-base font-bold text-white">Prizes</h3>
          </div>
          <div className="space-y-3">
            {prizes.badges?.map((badge, i) => (
              <motion.div
                key={`badge-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5"
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-sm text-gray-300">{badge}</span>
              </motion.div>
            ))}
            {prizes.rewards?.map((reward, i) => (
              <motion.div
                key={`reward-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (prizes.badges?.length ?? 0) * 0.1 + i * 0.1 }}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-sm text-gray-300">{reward}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Eligibility */}
      {competition.eligibility && Object.keys(competition.eligibility).length > 0 && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Eligibility Criteria</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(competition.eligibility).map(([key, value], i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5"
              >
                <span className="text-sm text-gray-400 capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-medium text-white">{String(value)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Anti-cheat Policy */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-violet-400" />
          <h3 className="text-base font-bold text-white">Fair Play Policy</h3>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          All submissions are verified using our anti-cheat system. Automated tracking ensures
          accuracy and fairness. Manipulated data, multiple accounts, or external exploits result
          in immediate disqualification. Appeals can be submitted within 48 hours of any action.
        </p>
      </div>

      {/* Timeline */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Timeline</h3>
        </div>
        <div className="relative pl-6 space-y-6">
          {/* Vertical line */}
          <div className="absolute left-2.25 top-1 bottom-1 w-px bg-linear-to-b from-emerald-500 via-cyan-500 to-gray-700" />

          {milestones.map((milestone, i) => (
            <motion.div
              key={milestone.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="relative flex items-start gap-3"
            >
              <div
                className={cn(
                  'absolute -left-6 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center',
                  milestone.active
                    ? 'bg-emerald-500 border-emerald-400'
                    : 'bg-gray-800 border-gray-600'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    milestone.active ? 'bg-white' : 'bg-gray-600'
                  )}
                />
              </div>
              <div>
                <p className={cn('text-sm font-medium', milestone.active ? 'text-white' : 'text-gray-500')}>
                  {milestone.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {milestone.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CompetitionDetailView({
  competition,
  userEntry,
  currentUserId,
  onJoin,
  onLeave,
  onClose,
}: CompetitionDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('leaderboard');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const isJoined = !!userEntry;
  const countdown = useCountdown(competition.end_date);
  const statusConfig = STATUS_CONFIG[competition.status] ?? STATUS_CONFIG.draft;
  const participantCount = (competition as Competition & { participant_count?: number }).participant_count ?? 0;

  // ---------------------------------------------------------------------------
  // Real-time socket updates
  // ---------------------------------------------------------------------------

  useLeaderboardSocket({
    userId: currentUserId,
    enabled: !!currentUserId && isJoined,
    onCompetitionRankUpdate: (data) => {
      if (data.competition_id === competition.id && leaderboardData) {
        setLeaderboardData((prev) => {
          if (!prev) return prev;
          const updatedRanks = prev.ranks.map((entry) =>
            entry.user_id === data.user_id
              ? { ...entry, rank: data.rank, total_score: data.current_score ?? entry.total_score }
              : entry
          );
          updatedRanks.sort((a, b) => a.rank - b.rank);
          return { ...prev, ranks: updatedRanks };
        });
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadLeaderboard = useCallback(async () => {
    setIsLoadingLeaderboard(true);
    try {
      const data = await getCompetitionLeaderboard(competition.id);
      setLeaderboardData(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [competition.id]);

  useEffect(() => {
    if (isJoined && activeTab === 'leaderboard') {
      loadLeaderboard();
    }
  }, [isJoined, activeTab, loadLeaderboard]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleJoin = useCallback(() => {
    if (!onJoin) return;
    setIsJoining(true);
    setShowConfetti(true);
    onJoin(competition.id);

    // Reset confetti after animation completes
    setTimeout(() => {
      setShowConfetti(false);
      setIsJoining(false);
    }, 1500);
  }, [onJoin, competition.id]);

  const handleLeaveConfirm = useCallback(() => {
    onLeave?.(competition.id);
    setShowLeaveModal(false);
  }, [onLeave, competition.id]);

  // ---------------------------------------------------------------------------
  // Live streams (WebRTC)
  // ---------------------------------------------------------------------------

  const {
    participants: roomParticipants,
    isInRoom,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    joinRoom,
    leaveRoom: leaveVideoRoom,
    toggleAudio,
    toggleVideo,
  } = useVideoRoom(competition.id);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative space-y-0">
      {/* Confetti overlay */}
      <JoinConfetti isPlaying={showConfetti} />

      {/* Leave confirmation */}
      <LeaveConfirmationModal
        isOpen={showLeaveModal}
        onConfirm={handleLeaveConfirm}
        onCancel={() => setShowLeaveModal(false)}
        competitionName={competition.name}
      />

      {/* ================================================================== */}
      {/* HEADER BANNER                                                      */}
      {/* ================================================================== */}
      <motion.header
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-white/10"
      >
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-linear-to-br from-emerald-600/20 via-cyan-600/10 to-emerald-500/15" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.25) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)',
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative p-5 sm:p-7">
          {/* Top row: close button + badges */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              {competition.type === 'ai_generated' && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-linear-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold rounded-full"
                >
                  <Zap className="w-3 h-3" />
                  AI Generated
                </motion.span>
              )}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs font-semibold rounded-full',
                  statusConfig.bg,
                  statusConfig.color
                )}
              >
                {competition.status === 'active' && (
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                {statusConfig.label}
              </motion.span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                aria-label="Close competition details"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Title + description */}
          <div className="flex items-start gap-4 mb-6">
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25"
            >
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight mb-1.5 truncate">
                {competition.name}
              </h1>
              {competition.description && (
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                  {competition.description}
                </p>
              )}
            </div>
          </div>

          {/* Countdown + Rank + Actions row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-5">
            {/* Left: Countdown timer */}
            <div className="space-y-3 flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {competition.status === 'ended' ? 'Competition ended' : 'Time remaining'}
              </p>
              {competition.status !== 'ended' ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <CountdownDigit value={countdown.days} label="Days" />
                  <CountdownSeparator />
                  <CountdownDigit value={countdown.hours} label="Hrs" />
                  <CountdownSeparator />
                  <CountdownDigit value={countdown.minutes} label="Min" />
                  <CountdownSeparator />
                  <CountdownDigit value={countdown.seconds} label="Sec" />
                </div>
              ) : (
                <p className="text-lg font-bold text-gray-500">Competition has ended</p>
              )}

              {/* Progress bar */}
              <div className="max-w-md">
                <CompetitionProgress
                  startDate={competition.start_date}
                  endDate={competition.end_date}
                />
              </div>
            </div>

            {/* Right: Rank + CTA */}
            <div className="flex items-end gap-4">
              {isJoined && userEntry && (
                <RankBadge rank={userEntry.current_rank} />
              )}

              <div className="flex flex-col items-end gap-2">
                {isJoined ? (
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-1">
                      <p className="text-xs text-gray-500">Score</p>
                      <p className="text-lg font-bold text-white tabular-nums">
                        {userEntry?.current_score?.toFixed(1) ?? '0.0'}
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowLeaveModal(true)}
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50"
                    >
                      Leave
                    </Button>
                  </div>
                ) : (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleJoin}
                      disabled={isJoining || competition.status === 'ended'}
                      className="relative bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      {isJoining ? (
                        <motion.div
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                      ) : (
                        <>
                          <Trophy className="w-4 h-4 mr-2" />
                          Join Competition
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Participant count + avatar stack */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <ParticipantAvatarStack
              count={participantCount}
              avatars={
                leaderboardData
                  ? leaderboardData.ranks.slice(0, 5).map((e) => ({
                      name: e.user?.name ?? `User ${e.rank}`,
                      avatar: e.user?.avatar,
                    }))
                  : []
              }
            />
          </div>
        </div>
      </motion.header>

      {/* ================================================================== */}
      {/* TABS                                                               */}
      {/* ================================================================== */}
      <div className="sticky top-0 z-30 pt-4 pb-1 -mx-0.5 px-0.5 backdrop-blur-xl bg-gray-950/80">
        <div
          className="flex items-center gap-1 p-1 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl"
          role="tablist"
          aria-label="Competition sections"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors duration-200',
                  isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 rounded-lg bg-linear-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                </span>
                {/* Live pulse on chat tab (always) and streams tab (when participants) */}
                {(tab.id === 'chat' || (tab.id === 'streams' && roomParticipants.length > 0)) && (
                  <motion.div
                    className="relative z-10 w-1.5 h-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================== */}
      {/* TAB CONTENT                                                        */}
      {/* ================================================================== */}
      <div className="pt-4">
        <AnimatePresence mode="wait">
          {/* ----- Leaderboard ----- */}
          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              id="panel-leaderboard"
              role="tabpanel"
              aria-labelledby="tab-leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
            >
              {isJoined ? (
                isLoadingLeaderboard ? (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                    <motion.div
                      className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="text-gray-400 text-sm">Loading leaderboard...</p>
                  </div>
                ) : leaderboardData ? (
                  <LeaderboardList
                    entries={leaderboardData.ranks}
                    startRank={1}
                    total={leaderboardData.pagination.total}
                    currentUserId={currentUserId}
                  />
                ) : (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                    <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-4">Could not load leaderboard data.</p>
                    <Button
                      onClick={loadLeaderboard}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Retry
                    </Button>
                  </div>
                )
              ) : (
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 sm:p-14 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-20 h-20 rounded-3xl bg-linear-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5"
                  >
                    <Trophy className="w-10 h-10 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Join to view the leaderboard
                  </h3>
                  <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                    Compete with other participants, track your rank, and climb to the top.
                  </p>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleJoin}
                      disabled={isJoining || competition.status === 'ended'}
                      className="bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Join Competition
                    </Button>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ----- Live Chat ----- */}
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              id="panel-chat"
              role="tabpanel"
              aria-labelledby="tab-chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
            >
              <CompetitionLiveChat competitionId={competition.id} isOpen={true} />
            </motion.div>
          )}

          {/* ----- Live Streams (Shared Room) ----- */}
          {activeTab === 'streams' && (
            <motion.div
              key="streams"
              id="panel-streams"
              role="tabpanel"
              aria-labelledby="tab-streams"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Header: participant count + Join button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {roomParticipants.length > 0 && (
                    <motion.div
                      className="w-2 h-2 rounded-full bg-red-500"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                  <span className="text-sm font-medium text-white">
                    {roomParticipants.length} in room
                  </span>
                </div>

                {isJoined && (
                  <GoLiveButton
                    isInRoom={isInRoom}
                    onJoinRoom={joinRoom}
                  />
                )}
              </div>

              {/* Video grid — all participants including self */}
              {(isInRoom || roomParticipants.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Self tile (when in room) */}
                  {isInRoom && (
                    <motion.div
                      key="self"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <CameraStreamPlaceholder
                        userId={currentUserId}
                        userName="You"
                        isLive
                        audioEnabled={audioEnabled}
                        videoEnabled={videoEnabled}
                        mediaStream={localStream}
                        muted
                      />
                    </motion.div>
                  )}

                  {/* Other participants */}
                  {roomParticipants
                    .filter((p) => p.userId !== currentUserId)
                    .map((participant, i) => (
                      <motion.div
                        key={participant.userId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <CameraStreamPlaceholder
                          userId={participant.userId}
                          userName={participant.userName}
                          userAvatar={participant.userAvatar}
                          isLive
                          audioEnabled={participant.audioEnabled}
                          videoEnabled={participant.videoEnabled}
                          mediaStream={remoteStreams.get(participant.userId) ?? null}
                        />
                      </motion.div>
                    ))}
                </div>
              )}

              {/* Stream controls (when in room) */}
              {isInRoom && (
                <StreamControls
                  audioEnabled={audioEnabled}
                  videoEnabled={videoEnabled}
                  onToggleAudio={toggleAudio}
                  onToggleVideo={toggleVideo}
                  onLeave={leaveVideoRoom}
                />
              )}

              {/* Empty state */}
              {roomParticipants.length === 0 && !isInRoom && (
                <p className="text-center text-gray-500 text-xs pt-2">
                  No one is streaming yet. {isJoined ? 'Be the first to join!' : 'Join the competition to start streaming.'}
                </p>
              )}
            </motion.div>
          )}

          {/* ----- Details ----- */}
          {activeTab === 'details' && (
            <motion.div
              key="details"
              id="panel-details"
              role="tabpanel"
              aria-labelledby="tab-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
            >
              <DetailsTabContent competition={competition} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
