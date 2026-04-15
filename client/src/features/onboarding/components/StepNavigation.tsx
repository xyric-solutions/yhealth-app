'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface StepNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  backLabel?: string;
  skipLabel?: string;
  showBack?: boolean;
  showSkip?: boolean;
  isNextDisabled?: boolean;
  isLoading?: boolean;
}

export function StepNavigation({
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continue',
  backLabel = 'Back',
  skipLabel = 'Skip for now',
  showBack = true,
  showSkip = false,
  isNextDisabled = false,
  isLoading = false,
}: StepNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-4 mt-8">
      {/* Back Button */}
      <div className="flex-1">
        {showBack && onBack && (
          <motion.button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors group"
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">{backLabel}</span>
          </motion.button>
        )}
      </div>

      {/* Skip Button */}
      {showSkip && onSkip && (
        <motion.button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors underline-offset-4 hover:underline"
          whileTap={{ scale: 0.95 }}
        >
          {skipLabel}
        </motion.button>
      )}

      {/* Next Button */}
      <div className="flex-1 flex justify-end">
        {onNext && (
          <motion.button
            onClick={onNext}
            disabled={isNextDisabled || isLoading}
            className={`
              relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold
              transition-all duration-300 group overflow-hidden
              ${
                isNextDisabled || isLoading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:shadow-blue-500/25'
              }
            `}
            whileHover={!isNextDisabled && !isLoading ? { scale: 1.02 } : {}}
            whileTap={!isNextDisabled && !isLoading ? { scale: 0.98 } : {}}
          >
            {/* Shimmer effect */}
            {!isNextDisabled && !isLoading && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              />
            )}

            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{nextLabel}</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
}
