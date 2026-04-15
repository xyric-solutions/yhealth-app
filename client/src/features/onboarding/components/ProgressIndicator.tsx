'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import type { OnboardingStepConfig } from '../types';

interface ProgressIndicatorProps {
  steps: OnboardingStepConfig[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function ProgressIndicator({
  steps,
  currentStep,
  onStepClick,
}: ProgressIndicatorProps) {
  const progress = (currentStep / (steps.length - 1)) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Desktop Stepper */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Background Track */}
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800">
            {/* Animated Progress Line */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                boxShadow:
                  '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3)',
              }}
            />
          </div>

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isClickable = onStepClick && index <= currentStep;

              return (
                <motion.button
                  key={step.id}
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    relative flex flex-col items-center group z-10
                    ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                  `}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Step Circle */}
                  <motion.div
                    className={`
                      relative w-12 h-12 rounded-full flex items-center justify-center
                      transition-all duration-500 border-2
                      ${
                        isCompleted
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500 border-emerald-400/50 shadow-lg shadow-emerald-500/30'
                          : isCurrent
                            ? 'bg-gradient-to-br from-cyan-500 to-teal-500 border-cyan-400/50 shadow-lg shadow-cyan-500/40'
                            : 'bg-slate-900/80 border-slate-700/50 backdrop-blur-sm'
                      }
                    `}
                    whileHover={isClickable ? { scale: 1.1 } : {}}
                    whileTap={isClickable ? { scale: 0.95 } : {}}
                  >
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                      >
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </motion.div>
                    ) : isCurrent ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="relative"
                      >
                        <Sparkles className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : (
                      <span className="text-sm font-bold text-slate-500">
                        {index + 1}
                      </span>
                    )}

                    {/* Pulse Ring for Current Step */}
                    {isCurrent && (
                      <>
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
                          animate={{
                            scale: [1, 1.4, 1.4],
                            opacity: [0.6, 0, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeOut',
                          }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                          animate={{
                            scale: [1, 1.6, 1.6],
                            opacity: [0.4, 0, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeOut',
                            delay: 0.3,
                          }}
                        />
                      </>
                    )}

                    {/* Glow Effect for Completed */}
                    {isCompleted && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-emerald-400/20 blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    )}
                  </motion.div>

                  {/* Step Label */}
                  <motion.div
                    className="mt-3 flex flex-col items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    <span
                      className={`
                        text-xs font-semibold tracking-wide uppercase
                        ${isCurrent ? 'text-cyan-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'}
                      `}
                    >
                      {step.shortLabel}
                    </span>
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Stepper - Compact Version */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          {/* Progress Pills */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <motion.div
                  key={index}
                  className={`
                    h-2 rounded-full transition-all duration-300
                    ${isCurrent ? 'w-8 bg-gradient-to-r from-cyan-500 to-teal-500' : isCompleted ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-700'}
                  `}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                />
              );
            })}
          </div>

          {/* Step Counter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400">
              {currentStep + 1}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-sm text-slate-500">{steps.length}</span>
          </div>
        </div>
      </div>

      {/* Current Step Info - Both Mobile and Desktop */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center mt-6 md:mt-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-white">
          {steps[currentStep]?.label}
        </h2>
      </motion.div>
    </div>
  );
}
