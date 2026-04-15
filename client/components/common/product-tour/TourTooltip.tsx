"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Trophy,
  Bot,
  Flame,
  Link,
  Users,
  Shield,
  Sparkles,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { tooltipVariants, tooltipContentVariants, tooltipContentItem } from "./tour-variants";
import { TourProgressBar } from "./TourProgressBar";
import { calculateTooltipPosition, interpolateText } from "./tour-utils";
import type { TourStepConfig, TooltipPosition } from "./types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  Trophy,
  Bot,
  Flame,
  Link,
  Users,
  Shield,
  Sparkles,
  PartyPopper,
};

interface TourTooltipProps {
  step: TourStepConfig;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  currentStep: number;
  totalSteps: number;
  userName?: string;
  visible: boolean;
  reducedMotion?: boolean;
  isMobile?: boolean;
}

/**
 * Glassmorphism tooltip card that displays step content
 * and positions itself relative to the spotlight target.
 */
export function TourTooltip({
  step,
  targetRect,
  onNext,
  onPrev,
  onSkip,
  currentStep,
  totalSteps,
  userName = "there",
  visible,
  reducedMotion = false,
  isMobile = false,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const TOOLTIP_SIZE = { width: 380, height: 220 };

  // Calculate position when target or step changes
  const updatePosition = useCallback(() => {
    if (isMobile || !targetRect || step.type === "fullscreen") {
      setPosition(null);
      return;
    }

    const pos = calculateTooltipPosition(
      targetRect,
      TOOLTIP_SIZE,
      step.tooltipPosition ?? "auto"
    );
    setPosition(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRect, step.type, step.tooltipPosition, isMobile]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  const Icon = step.icon ? ICON_MAP[step.icon] : null;
  const title = interpolateText(step.title, { firstName: userName });
  const description = interpolateText(step.description, { firstName: userName });
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const primaryCta = step.ctaPrimary ?? (isLastStep ? "Finish" : "Next");
  const accentGradient = step.accentColor ?? "from-cyan-500 to-blue-500";

  // Mobile: bottom sheet style
  if (isMobile) {
    return (
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            ref={tooltipRef}
            className="fixed bottom-0 left-0 right-0 z-[10001] p-4"
            variants={reducedMotion ? undefined : tooltipVariants}
            initial={reducedMotion ? { opacity: 1 } : "hidden"}
            animate={reducedMotion ? { opacity: 1 } : "visible"}
            exit={reducedMotion ? { opacity: 0 } : "exit"}
            key={step.id}
          >
            <TooltipContent
              title={title}
              description={description}
              Icon={Icon}
              accentGradient={accentGradient}
              primaryCta={primaryCta}
              isFirstStep={isFirstStep}
              currentStep={currentStep}
              totalSteps={totalSteps}
              onNext={onNext}
              onPrev={onPrev}
              onSkip={onSkip}
              reducedMotion={reducedMotion}
              className="rounded-t-3xl rounded-b-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: positioned relative to target
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          ref={tooltipRef}
          className="fixed z-[10001]"
          style={
            position
              ? { top: position.y, left: position.x, maxWidth: 400 }
              : {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  maxWidth: 400,
                }
          }
          variants={reducedMotion ? undefined : tooltipVariants}
          initial={reducedMotion ? { opacity: 1 } : "hidden"}
          animate={reducedMotion ? { opacity: 1 } : "visible"}
          exit={reducedMotion ? { opacity: 0 } : "exit"}
          key={step.id}
          role="alertdialog"
          aria-labelledby="tour-step-title"
          aria-describedby="tour-step-description"
        >
          <TooltipContent
            title={title}
            description={description}
            Icon={Icon}
            accentGradient={accentGradient}
            primaryCta={primaryCta}
            isFirstStep={isFirstStep}
            currentStep={currentStep}
            totalSteps={totalSteps}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            reducedMotion={reducedMotion}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface TooltipContentProps {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }> | null;
  accentGradient: string;
  primaryCta: string;
  isFirstStep: boolean;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  reducedMotion: boolean;
  className?: string;
}

function TooltipContent({
  title,
  description,
  Icon,
  accentGradient,
  primaryCta,
  isFirstStep,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  reducedMotion,
  className = "rounded-3xl",
}: TooltipContentProps) {
  return (
    <motion.div
      className={`glass-card ${className} p-6 w-full max-w-[400px] border border-white/10 shadow-2xl`}
      variants={reducedMotion ? undefined : tooltipContentVariants}
      initial={reducedMotion ? undefined : "hidden"}
      animate={reducedMotion ? undefined : "visible"}
    >
      {/* Header */}
      <motion.div
        className="flex items-start justify-between mb-3"
        variants={reducedMotion ? undefined : tooltipContentItem}
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${accentGradient} text-white`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3
              id="tour-step-title"
              className="text-lg font-semibold text-white leading-tight"
            >
              {title}
            </h3>
            <span className="text-xs text-white/50">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
        </div>
        <button
          onClick={onSkip}
          className="text-white/50 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Description */}
      <motion.p
        id="tour-step-description"
        className="text-sm text-slate-300 leading-relaxed mb-5"
        variants={reducedMotion ? undefined : tooltipContentItem}
      >
        {description}
      </motion.p>

      {/* Footer: progress + navigation */}
      <motion.div
        className="flex items-center justify-between"
        variants={reducedMotion ? undefined : tooltipContentItem}
      >
        <TourProgressBar
          currentStep={currentStep}
          totalSteps={totalSteps}
          reducedMotion={reducedMotion}
        />

        <div className="flex items-center gap-2" role="group" aria-label="Tour navigation">
          {!isFirstStep && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/5"
              aria-label="Go to previous step"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className={`flex items-center gap-1 text-sm font-medium text-white px-5 py-2.5 rounded-xl bg-gradient-to-r ${accentGradient} hover:opacity-90 transition-opacity active:scale-[0.97]`}
            aria-label={
              currentStep === totalSteps - 1
                ? "Finish tour"
                : "Go to next step"
            }
          >
            {primaryCta}
            {currentStep < totalSteps - 1 && (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
