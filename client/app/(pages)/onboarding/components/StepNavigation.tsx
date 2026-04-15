"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ArrowRight, Loader2 } from "lucide-react";

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
  nextLabel = "Continue",
  backLabel = "Back",
  skipLabel = "Skip for now",
  showBack = true,
  showSkip = false,
  isNextDisabled = false,
  isLoading = false,
}: StepNavigationProps) {
  const enabled = !isNextDisabled && !isLoading;

  return (
    <div className="flex flex-col gap-4 mt-8">
      {/* Next Button — full width, sky-600 */}
      {onNext && (
        <motion.button
          onClick={onNext}
          disabled={!enabled}
          className={`
            w-full flex items-center justify-center gap-2
            px-6 py-3 sm:py-3.5 rounded-xl font-medium text-base sm:text-lg
            transition-all duration-300 border border-white/20
            ${
              enabled
                ? "bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-600/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700"
            }
          `}
          whileHover={enabled ? { scale: 1.01 } : {}}
          whileTap={enabled ? { scale: 0.99 } : {}}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{nextLabel}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>
      )}

      {/* Back + Skip row */}
      <div className="flex items-center justify-between">
        <div>
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

        {showSkip && onSkip && (
          <motion.button
            onClick={onSkip}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors underline-offset-4 hover:underline"
            whileTap={{ scale: 0.95 }}
          >
            {skipLabel}
          </motion.button>
        )}
      </div>
    </div>
  );
}
