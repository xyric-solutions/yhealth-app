'use client';

import { motion } from 'framer-motion';
import {
  Target,
  Dumbbell,
  Moon,
  Brain,
  Zap,
  Trophy,
  Heart,
  TrendingUp,
  Edit3,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../context/OnboardingContext';
import type { GoalCategory } from '@/src/types';

interface GoalOption {
  id: GoalCategory;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  accent: string;
}

const goalOptions: GoalOption[] = [
  {
    id: 'weight_loss',
    icon: <Target className="w-6 h-6" />,
    title: 'Lose Weight',
    description:
      'Achieve sustainable weight loss with personalized nutrition and exercise',
    gradient: 'from-rose-500/10 via-pink-500/5 to-transparent',
    iconBg: 'bg-rose-500/20 text-rose-400 group-hover:bg-rose-500/30',
    accent: 'group-hover:border-rose-500/50 group-hover:shadow-rose-500/10',
  },
  {
    id: 'muscle_building',
    icon: <Dumbbell className="w-6 h-6" />,
    title: 'Build Muscle',
    description: 'Gain strength and muscle mass with targeted training programs',
    gradient: 'from-orange-500/10 via-amber-500/5 to-transparent',
    iconBg: 'bg-orange-500/20 text-orange-400 group-hover:bg-orange-500/30',
    accent: 'group-hover:border-orange-500/50 group-hover:shadow-orange-500/10',
  },
  {
    id: 'sleep_improvement',
    icon: <Moon className="w-6 h-6" />,
    title: 'Sleep Better',
    description: 'Optimize your sleep quality and wake up refreshed every day',
    gradient: 'from-indigo-500/10 via-violet-500/5 to-transparent',
    iconBg: 'bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30',
    accent: 'group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/10',
  },
  {
    id: 'stress_wellness',
    icon: <Brain className="w-6 h-6" />,
    title: 'Reduce Stress',
    description:
      'Build resilience and manage stress through mindfulness practices',
    gradient: 'from-purple-500/10 via-fuchsia-500/5 to-transparent',
    iconBg: 'bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30',
    accent: 'group-hover:border-purple-500/50 group-hover:shadow-purple-500/10',
  },
  {
    id: 'energy_productivity',
    icon: <Zap className="w-6 h-6" />,
    title: 'Boost Energy',
    description: 'Increase your daily energy levels and productivity',
    gradient: 'from-yellow-500/10 via-amber-500/5 to-transparent',
    iconBg: 'bg-yellow-500/20 text-yellow-400 group-hover:bg-yellow-500/30',
    accent: 'group-hover:border-yellow-500/50 group-hover:shadow-yellow-500/10',
  },
  {
    id: 'event_training',
    icon: <Trophy className="w-6 h-6" />,
    title: 'Train for Event',
    description: 'Prepare for a marathon, competition, or special occasion',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    iconBg: 'bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30',
    accent: 'group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/10',
  },
  {
    id: 'health_condition',
    icon: <Heart className="w-6 h-6" />,
    title: 'Manage Condition',
    description:
      'Support your health with lifestyle modifications for your condition',
    gradient: 'from-red-500/10 via-rose-500/5 to-transparent',
    iconBg: 'bg-red-500/20 text-red-400 group-hover:bg-red-500/30',
    accent: 'group-hover:border-red-500/50 group-hover:shadow-red-500/10',
  },
  {
    id: 'overall_optimization',
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Optimize Health',
    description: 'Improve overall wellness across all health pillars',
    gradient: 'from-cyan-500/10 via-teal-500/5 to-transparent',
    iconBg: 'bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/30',
    accent: 'group-hover:border-cyan-500/50 group-hover:shadow-cyan-500/10',
  },
  {
    id: 'custom',
    icon: <Edit3 className="w-6 h-6" />,
    title: 'Custom Goal',
    description: 'Define your own unique health and wellness objective',
    gradient: 'from-slate-500/10 via-slate-600/5 to-transparent',
    iconBg: 'bg-slate-500/20 text-slate-400 group-hover:bg-slate-500/30',
    accent: 'group-hover:border-slate-500/50 group-hover:shadow-slate-500/10',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export function WelcomeStep() {
  const {
    selectedGoal,
    setSelectedGoal,
    customGoalText,
    setCustomGoalText,
    nextStep,
  } = useOnboarding();

  const [showCustomInput, setShowCustomInput] = useState(
    selectedGoal === 'custom'
  );

  const handleGoalSelect = (goalId: GoalCategory) => {
    setSelectedGoal(goalId);
    setShowCustomInput(goalId === 'custom');
    if (goalId !== 'custom') {
      setCustomGoalText('');
    }
  };

  const canContinue =
    selectedGoal !== null &&
    (selectedGoal !== 'custom' || customGoalText.trim().length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      {/* Welcome Header */}
      <motion.div
        className="text-center mb-10 md:mb-14"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-emerald-500/10 border border-cyan-500/20 mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-cyan-400">
            Let&apos;s personalize your journey
          </span>
        </motion.div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
          What&apos;s Your{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Primary Goal
          </span>
          ?
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Choose the goal that matters most to you right now. We&apos;ll create
          a personalized plan tailored to help you achieve it.
        </p>
      </motion.div>

      {/* Goal Cards Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {goalOptions.map((goal) => {
          const isSelected = selectedGoal === goal.id;

          return (
            <motion.button
              key={goal.id}
              variants={cardVariants}
              onClick={() => handleGoalSelect(goal.id)}
              className={`
                group relative p-5 sm:p-6 rounded-2xl text-left transition-all duration-300
                border backdrop-blur-sm overflow-hidden
                ${
                  isSelected
                    ? 'border-cyan-500/60 bg-cyan-500/10 shadow-xl shadow-cyan-500/10'
                    : `border-slate-800/80 bg-slate-900/50 hover:bg-slate-800/50 ${goal.accent}`
                }
              `}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Background gradient on hover/select */}
              <div
                className={`
                  absolute inset-0 bg-gradient-to-br ${goal.gradient}
                  transition-opacity duration-300
                  ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
              />

              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </motion.div>
              )}

              {/* Content */}
              <div className="relative z-10">
                <div
                  className={`
                    w-12 h-12 rounded-xl flex items-center justify-center mb-4
                    transition-all duration-300 ${goal.iconBg}
                  `}
                >
                  {goal.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white transition-colors">
                  {goal.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 group-hover:text-slate-300 transition-colors">
                  {goal.description}
                </p>
              </div>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Custom Goal Input */}
      {showCustomInput && (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <textarea
              value={customGoalText}
              onChange={(e) => setCustomGoalText(e.target.value.slice(0, 200))}
              placeholder="Describe your custom health goal..."
              className="w-full px-5 py-4 rounded-xl bg-slate-900/50 border border-slate-700/50
                       text-white placeholder-slate-500 resize-none
                       focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                       transition-all duration-300 text-base"
              rows={3}
            />
            <div className="absolute bottom-3 right-4 text-xs text-slate-500 font-medium">
              {customGoalText.length}/200
            </div>
          </div>
        </motion.div>
      )}

      {/* Continue Button */}
      <motion.div
        className="flex justify-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          onClick={nextStep}
          disabled={!canContinue}
          className={`
            group relative flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-base
            transition-all duration-300 overflow-hidden
            ${
              canContinue
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }
          `}
          whileHover={canContinue ? { scale: 1.02 } : {}}
          whileTap={canContinue ? { scale: 0.98 } : {}}
        >
          {/* Shimmer effect */}
          {canContinue && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            />
          )}
          <span className="relative z-10">Continue to Assessment</span>
          <ArrowRight
            className={`
            w-5 h-5 relative z-10 transition-transform duration-300
            ${canContinue ? 'group-hover:translate-x-1' : ''}
          `}
          />
        </motion.button>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-800/50 via-slate-800/30 to-slate-800/50 border border-slate-700/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm sm:text-base text-slate-300">
              <span className="text-cyan-400 font-medium">Pro tip:</span> You
              can add more goals later. Start with the one that excites you
              most!
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
