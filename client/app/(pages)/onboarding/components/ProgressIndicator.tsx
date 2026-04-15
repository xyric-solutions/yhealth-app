"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface Step {
  id: number;
  label: string;
  shortLabel: string;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function ProgressIndicator({
  steps,
  currentStep,
  onStepClick,
}: ProgressIndicatorProps) {
  return (
    <div className="w-full">
      {/* Desktop Stepper */}
      <div className="hidden md:block overflow-x-auto">
        <div className="flex items-start justify-between min-w-[560px] lg:min-w-0">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = onStepClick && index <= currentStep;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="flex items-start flex-1">
                {/* Step circle + label */}
                <motion.button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    flex flex-col items-center gap-1.5 shrink-0
                    ${isClickable ? "cursor-pointer" : "cursor-default"}
                  `}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* Circle */}
                  <div
                    className={`
                      w-[30px] h-[30px] rounded-full flex items-center justify-center
                      text-sm font-medium transition-all duration-300
                      ${
                        isCompleted
                          ? "bg-sky-600 border-[3px] border-sky-600/30"
                          : isCurrent
                            ? "bg-sky-600 border-[3px] border-sky-600/30"
                            : "border border-white/40 bg-transparent"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    ) : isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-white" />
                    ) : (
                      <span className="text-white/40 text-xs font-medium">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`
                      text-xs lg:text-sm font-medium whitespace-nowrap
                      ${isCurrent || isCompleted ? "text-white" : "text-white/40"}
                    `}
                  >
                    {step.shortLabel}
                  </span>
                </motion.button>

                {/* Connecting line — solid */}
                {!isLast && (
                  <div className="flex-1 flex items-center px-1 lg:px-2 mt-[14px]">
                    <div
                      className={`
                        w-full h-[2px] rounded-full transition-colors duration-300
                        ${index < currentStep ? "bg-sky-600" : "bg-white/15"}
                      `}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Stepper */}
      <div className="md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {steps.map((_, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <motion.div
                  key={index}
                  className={`
                    h-1.5 rounded-full transition-all duration-300
                    ${isCurrent ? "w-6 bg-sky-600" : isCompleted ? "w-1.5 bg-sky-600" : "w-1.5 bg-slate-700"}
                  `}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.04 }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1 text-sm">
            <span className="text-white/40">Steps:</span>
            <span className="font-medium text-white">
              {currentStep + 1}/{steps.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
