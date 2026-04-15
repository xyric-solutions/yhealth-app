'use client';

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Target, Share2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { DailyScore } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Component Score Item with animated progress
function ComponentScoreItem({ label, value, color, index }: { label: string; value: number; color: string; index: number }) {
  const progress = useMotionValue(0);
  const springProgress = useSpring(progress, { stiffness: 100, damping: 20 });
  const width = useTransform(springProgress, (v) => `${v}%`);
  const opacity = useTransform(springProgress, [0, 100], [0.3, 1]);

  useEffect(() => {
    progress.set(value);
  }, [value, progress]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white/10 rounded-lg p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-300 text-sm font-medium">{label}</span>
        <motion.span
          className="text-white font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.3 }}
        >
          {value.toFixed(0)}
        </motion.span>
      </div>
      <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full bg-gradient-to-r rounded-full', color)}
          style={{ width, opacity }}
        />
      </div>
    </motion.div>
  );
}

interface DailyScoreCardProps {
  score: DailyScore | null;
  isLoading?: boolean;
  previousScore?: DailyScore | null;
}

export function DailyScoreCard({ score, isLoading, previousScore }: DailyScoreCardProps) {
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [displayedScore, setDisplayedScore] = useState(0);

  // Animated score counter
  useEffect(() => {
    if (!score) return;
    
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = score.total_score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score.total_score, increment * step);
      setDisplayedScore(current);
      
      if (step >= steps) {
        clearInterval(timer);
        setDisplayedScore(score.total_score);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const handleShare = async () => {
    if (!score) return;
    
    const text = `My daily fitness score: ${Number(score.total_score).toFixed(1)}/100! 🏆\n\nWorkout: ${score.component_scores.workout}\nNutrition: ${score.component_scores.nutrition}\nWellbeing: ${score.component_scores.wellbeing}\nBiometrics: ${score.component_scores.biometrics}\nEngagement: ${score.component_scores.engagement}\nConsistency: ${score.component_scores.consistency}`;
    
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Score copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // User cancelled or error
      if (err instanceof Error && err.name !== 'AbortError') {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Score copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const getRankChange = (current: number | null | undefined, previous: number | null | undefined) => {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    const change = previous - current;
    if (change === 0) return null;
    return change > 0 ? { direction: 'up', value: change } : { direction: 'down', value: Math.abs(change) };
  };

  if (isLoading || !score) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    );
  }

  const componentScores = [
    { label: 'Workout', value: score.component_scores.workout, color: 'from-orange-500 to-red-500' },
    { label: 'Nutrition', value: score.component_scores.nutrition, color: 'from-green-500 to-emerald-500' },
    { label: 'Wellbeing', value: score.component_scores.wellbeing, color: 'from-purple-500 to-violet-500' },
    { label: 'Biometrics', value: score.component_scores.biometrics, color: 'from-pink-500 to-rose-500' },
    { label: 'Engagement', value: score.component_scores.engagement, color: 'from-blue-500 to-indigo-500' },
    { label: 'Consistency', value: score.component_scores.consistency, color: 'from-amber-500 to-yellow-500' },
  ];

  const getRankDisplay = (rank: number | null) => {
    if (rank === null) return 'N/A';
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const globalRankChange = getRankChange(score.rank.global, previousScore?.rank.global);
  const countryRankChange = getRankChange(score.rank.country, previousScore?.rank.country);
  const friendsRankChange = getRankChange(score.rank.friends, previousScore?.rank.friends);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-500/20 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-2xl"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Your Daily Score
          </h2>
          <p className="text-gray-300 text-sm">{score.date}</p>
        </div>
        <div className="text-right flex items-center gap-3">
          <motion.div
            key={displayedScore}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-4xl font-bold text-white mb-1">
              {displayedScore.toFixed(1)}
            </div>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-white hover:bg-white/10"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Component Scores with Animated Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {componentScores.map((component, index) => (
          <ComponentScoreItem
            key={component.label}
            label={component.label}
            value={component.value}
            color={component.color}
            index={index}
          />
        ))}
      </div>

      {/* Ranks with Change Indicators */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Global Rank', rank: score.rank.global, change: globalRankChange },
          { label: 'Country Rank', rank: score.rank.country, change: countryRankChange },
          { label: 'Friends Rank', rank: score.rank.friends, change: friendsRankChange },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="text-center bg-white/10 rounded-lg p-3 relative"
          >
            <div className="text-gray-400 text-xs mb-1">{item.label}</div>
            <div className="flex items-center justify-center gap-1">
              <div className="text-white font-bold text-lg">
                {getRankDisplay(item.rank)}
              </div>
              {item.change && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-semibold',
                    item.change.direction === 'up' ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {item.change.direction === 'up' ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{item.change.value}</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Explanation with Expand/Collapse */}
      {score.explanation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4"
        >
          <button
            onClick={() => setIsExplanationExpanded(!isExplanationExpanded)}
            className="w-full flex items-center justify-between p-4 bg-white/10 rounded-lg border border-white/20 hover:bg-white/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <span className="text-gray-300 text-sm font-medium">Score Explanation</span>
            </div>
            {isExplanationExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <AnimatePresence>
            {isExplanationExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-white/5 rounded-b-lg border-x border-b border-white/20">
                  <p className="text-gray-300 text-sm leading-relaxed">{score.explanation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

