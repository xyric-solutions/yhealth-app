'use client';

import { motion } from 'framer-motion';
import {
  Target,
  Activity,
  Apple,
  Moon,
  Brain,
  Zap,
  TrendingUp,
  Dumbbell,
  Leaf,
  Coffee,
  Flame,
  Star,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MCQQuestion, MCQOption } from './types';

interface MCQQuestionCardProps {
  question: MCQQuestion;
  selectedOptions: MCQOption[];
  onToggleOption: (option: MCQOption) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  progress?: number;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  lifestyle: Coffee,
  fitness: Dumbbell,
  nutrition: Apple,
  sleep: Moon,
  stress: Brain,
  goals: Target,
};

const getOptionIcon = (index: number, category: string): React.ComponentType<{ className?: string }> => {
  const iconSets: Record<string, React.ComponentType<{ className?: string }>[]> = {
    lifestyle: [Coffee, Activity, Zap, Star],
    fitness: [Dumbbell, Flame, TrendingUp, Star],
    nutrition: [Apple, Leaf, TrendingUp, Star],
    sleep: [Moon, Star, Zap, Leaf],
    stress: [Brain, Zap, Star, Leaf],
    goals: [Target, TrendingUp, Star, Flame],
  };
  const icons = iconSets[category] || iconSets.goals;
  return icons[index % icons.length];
};

export function MCQQuestionCard({
  question,
  selectedOptions,
  onToggleOption,
  onSubmit,
  isSubmitting = false,
  progress = 0,
}: MCQQuestionCardProps) {
  const CategoryIcon = categoryIcons[question.category] || Target;
  const isOptionSelected = (option: MCQOption) => selectedOptions.some((o) => o.id === option.id);
  const hasSelection = selectedOptions.length > 0;

  return (
    <div className="w-full max-w-[1091px] mx-auto">
      {/* Progress Bar */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
          <span className="text-white/60 font-medium">Assessment Progress</span>
          <span className="text-white font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 sm:h-4 bg-[#0b081e] rounded-xl overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-teal-400 rounded-xl"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              boxShadow: '0 0 12px rgba(6, 182, 212, 0.4)',
            }}
          />
        </div>
      </div>

      {/* Question — icon + text inline */}
      <motion.div
        key={question.question}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-10">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shrink-0">
            <CategoryIcon className="w-5 h-5 sm:w-7 sm:h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-[42px] md:leading-tight font-medium text-white">
            {question.question}
          </h2>
        </div>

        {/* Options — 2-column grid, horizontal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {question.options.map((option, index) => {
            const isSelected = isOptionSelected(option);
            const OptionIcon = getOptionIcon(index, question.category);

            return (
              <motion.button
                key={option.id}
                onClick={() => !isSubmitting && onToggleOption(option)}
                disabled={isSubmitting}
                className={cn(
                  'flex items-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-xl sm:rounded-2xl border text-left transition-all duration-200',
                  isSelected
                    ? 'border-emerald-600 border-[1.5px]'
                    : 'bg-[#02000f] border-white/[0.24] hover:border-white/40',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
                style={
                  isSelected
                    ? {
                        backgroundImage:
                          'linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)',
                      }
                    : undefined
                }
                whileHover={!isSubmitting ? { y: -2 } : undefined}
                whileTap={!isSubmitting ? { scale: 0.98 } : undefined}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'shrink-0 w-9 h-9 sm:w-[42px] sm:h-[42px] rounded-lg sm:rounded-xl flex items-center justify-center',
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/10 text-white/70 opacity-70'
                  )}
                >
                  <OptionIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'font-medium text-base sm:text-lg md:text-xl block',
                      isSelected ? 'text-white' : 'text-white'
                    )}
                  >
                    {option.text}
                  </span>
                  {option.insightValue && (
                    <span className="text-sm sm:text-base text-[rgba(239,237,253,0.7)] mt-1 block">
                      {option.insightValue}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Next Button — full width */}
        <motion.button
          onClick={onSubmit}
          disabled={!hasSelection || isSubmitting}
          className={cn(
            'w-full mt-6 sm:mt-10 flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 rounded-xl font-medium text-base sm:text-lg md:text-xl transition-all duration-300 border border-white/20',
            hasSelection && !isSubmitting
              ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-600/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'
          )}
          whileHover={hasSelection && !isSubmitting ? { scale: 1.01 } : undefined}
          whileTap={hasSelection && !isSubmitting ? { scale: 0.99 } : undefined}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : hasSelection ? (
            <>
              <span>Next</span>
              <ArrowRight className="w-5 h-5" />
            </>
          ) : (
            <span>Select an option to continue</span>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
