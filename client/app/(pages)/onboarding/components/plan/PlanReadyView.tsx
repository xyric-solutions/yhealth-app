'use client';

import { motion } from 'framer-motion';
import { Check, Calendar, AlertCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import type { PlanReadyViewProps } from './types';
import { ActivityCard } from './ActivityCard';
import { MilestoneCard } from './MilestoneCard';
import { StartPlanButton } from './StartPlanButton';

const ICON_BASE = '/Onboardingicons';

export function PlanReadyView({
  plan,
  goals,
  coachMessage,
  onStartPlan,
  isStarting,
  error,
  planSource = 'ai',
}: PlanReadyViewProps) {
  const primaryGoal = goals.find((g) => g.isPrimary) || goals[0];
  const showFallbackWarning = planSource !== 'ai';

  return (
    <motion.div
      className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Warning Banner */}
      {showFallbackWarning && <FallbackWarningBanner planSource={planSource} />}

      {/* Success Header */}
      <motion.div
        className="text-center mb-8 sm:mb-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Checkmark icon */}
        <motion.div
          className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3, stiffness: 200 }}
        >
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
          <div className="relative w-full h-full rounded-full bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-600/30 border-4 border-emerald-600/30">
            <Check className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={3} />
          </div>
        </motion.div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-3">
          Your Plan is{' '}
          <span className="text-emerald-400">Ready!</span>
        </h1>
        <p className="text-[rgba(239,237,253,0.6)] text-sm sm:text-base max-w-lg mx-auto">
          {coachMessage}
        </p>
      </motion.div>

      {/* Two Summary Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {/* Journey Progress Card */}
        <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#02000f] border border-white/[0.24]">
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sky-600/20 flex items-center justify-center relative">
            <Image src={`${ICON_BASE}/Calender.svg`} alt="" width={24} height={24} className="sm:w-7 sm:h-7" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-sky-600 text-[9px] font-bold text-white flex items-center justify-center">
              1
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[rgba(239,237,253,0.5)]">Journey Progress</span>
            <p className="text-sm sm:text-base font-semibold text-white">
              {primaryGoal?.timeline?.durationWeeks || 8}-Week Program
            </p>
            <span className="text-xs text-emerald-400">
              {plan.activities.filter(a => a.type === 'workout').length || 3} strength sessions/week
            </span>
          </div>
        </div>

        {/* Primary Goal Card */}
        <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#02000f] border border-white/[0.24]">
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Image src={`${ICON_BASE}/Optimize Health.svg`} alt="" width={24} height={24} className="sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[rgba(239,237,253,0.5)]">Primary Goal</span>
            <p className="text-sm sm:text-base font-semibold text-white">
              {primaryGoal?.title || 'Achieve your health goals'}
            </p>
            <span className="text-xs text-sky-400">
              Mon-Fri · 9:00 AM
            </span>
          </div>
        </div>
      </motion.div>

      {/* Week 1 Activities */}
      <motion.div
        className="mb-6 sm:mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">
            Week 1 Activities
          </h2>
          <span className="text-xs sm:text-sm text-slate-400">
            {plan.activities.length} Scheduled
          </span>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {plan.activities.map((activity, index) => (
            <ActivityCard key={activity.id} activity={activity} index={index} />
          ))}
        </div>
      </motion.div>

      {/* First Milestone */}
      {plan.milestones[0] && <MilestoneCard milestone={plan.milestones[0]} />}

      {/* Error Message */}
      {error && (
        <motion.div
          className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Start Button */}
      <StartPlanButton onClick={onStartPlan} isStarting={isStarting} />
    </motion.div>
  );
}

function FallbackWarningBanner({ planSource }: { planSource: 'ai' | 'fallback' | 'mock' }) {
  const message = planSource === 'mock'
    ? "We couldn't generate a personalized plan. You're seeing a template plan that you can customize later."
    : "Your plan was generated using basic settings. Some personalized features may be limited.";

  return (
    <motion.div
      className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-amber-300 text-sm font-medium">
          {planSource === 'mock' ? 'Template Plan' : 'Basic Plan'}
        </p>
        <p className="text-amber-400/80 text-sm mt-1">{message}</p>
      </div>
    </motion.div>
  );
}
