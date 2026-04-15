'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOnboarding } from '@/src/features/onboarding/context/OnboardingContext';
import { useOnboardingApi } from '../hooks/useOnboardingApi';
import { useGoalSetup } from '../hooks/useGoalSetup';
import { StepNavigation } from '../components/StepNavigation';
import { SuccessModal } from '@/components/common/success-modal';
import {
  GoalCard,
  AIReasoningCard,
  GoalsLoadingState,
  GoalsSummary,
  DurationSelector,
} from '../components/goals';

/**
 * GoalSetupStep - AI-powered goal generation and confirmation
 *
 * Features:
 * - AI-generated SMART goals based on assessment
 * - Goal editing (target, timeline, motivation)
 * - Confidence slider for commitment level
 * - Regenerate goals option
 */
export function GoalSetupStep() {
  const {
    selectedGoal,
    customGoalText,
    assessmentResponses,
    bodyStats,
    suggestedGoals,
    setSuggestedGoals,
    confirmedGoals,
    confirmGoal,
    removeGoal,
    updateGoalConfidence,
    planDurationWeeks,
    setPlanDuration,
    nextStep,
    prevStep,
  } = useOnboarding();

  const { acceptSuggestedGoals } = useOnboardingApi();

  const {
    expandedGoal,
    confidenceValues,
    editingGoal,
    editedGoals,
    isGenerating,
    error,
    aiReasoning,
    setExpandedGoal,
    handleToggleGoal,
    handleConfidenceChange,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditChange,
    handleTimelineChange,
    handleRegenerateGoals,
  } = useGoalSetup({
    selectedGoal,
    customGoalText,
    assessmentResponses,
    bodyStats,
    suggestedGoals,
    confirmedGoals,
    setSuggestedGoals,
    confirmGoal,
    removeGoal,
    updateGoalConfidence,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleContinue = useCallback(async () => {
    if (confirmedGoals.length === 0) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Apply the user-selected plan duration to each goal's timeline
      const goalsWithDuration = confirmedGoals.map((goal) => {
        const startDate = goal.timeline.startDate instanceof Date
          ? goal.timeline.startDate
          : new Date(goal.timeline.startDate);
        const newTargetDate = new Date(startDate);
        newTargetDate.setDate(newTargetDate.getDate() + planDurationWeeks * 7);

        return {
          ...goal,
          timeline: {
            ...goal.timeline,
            durationWeeks: planDurationWeeks,
            targetDate: newTargetDate,
          },
        };
      });

      await acceptSuggestedGoals(goalsWithDuration);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to save goals:', err);
      setSaveError('Failed to save your goals. Please try again.');
      setIsSaving(false);
    }
  }, [confirmedGoals, acceptSuggestedGoals, planDurationWeeks]);

  const handleSuccessModalClose = useCallback(() => {
    setShowSuccessModal(false);
    setIsSaving(false);
    nextStep();
  }, [nextStep]);

  const canContinue = confirmedGoals.length > 0 && !isSaving && !isGenerating;
  const displayError = error || saveError;

  // Loading state while generating goals
  if (isGenerating && suggestedGoals.length === 0) {
    return <GoalsLoadingState />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <GoalSetupHeader />

      {/* AI Reasoning Card */}
      {aiReasoning && <AIReasoningCard reasoning={aiReasoning} />}

      {/* Regenerate Button */}
      <motion.div
        className="flex justify-end mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <button
          onClick={handleRegenerateGoals}
          disabled={isGenerating}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-white/20 text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Regenerating...' : 'Regenerate Goals'}
        </button>
      </motion.div>

      {/* Goals List */}
      <div className="space-y-4 mb-8">
        {suggestedGoals.map((goal, index) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            index={index}
            isConfirmed={goal.id ? confirmedGoals.some((g) => g.id && g.id === goal.id) : false}
            isExpanded={expandedGoal === goal.id}
            isEditing={editingGoal === goal.id}
            confidence={confidenceValues[goal.id!] || 7}
            editedValues={editedGoals[goal.id!]}
            onToggle={() => handleToggleGoal(goal)}
            onExpand={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id!)}
            onStartEdit={() => handleStartEdit(goal)}
            onSaveEdit={() => handleSaveEdit(goal.id!)}
            onCancelEdit={handleCancelEdit}
            onEditChange={(field, value) => handleEditChange(goal.id!, field, value)}
            onTimelineChange={(weeks) => handleTimelineChange(goal.id!, weeks)}
            onConfidenceChange={(value) => handleConfidenceChange(goal.id!, value)}
          />
        ))}
      </div>

      {/* Plan Duration Selector */}
      <DurationSelector
        value={planDurationWeeks}
        onChange={setPlanDuration}
        disabled={isGenerating}
      />

      {/* Summary */}
      <GoalsSummary confirmedCount={confirmedGoals.length} />

      {/* Error message */}
      {displayError && (
        <motion.div
          className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{displayError}</p>
        </motion.div>
      )}

      {/* Navigation */}
      <StepNavigation
        onBack={prevStep}
        onNext={handleContinue}
        isNextDisabled={!canContinue}
        nextLabel={isSaving ? 'Saving Goals...' : 'Continue to Integrations'}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        type="goals"
        title="Goals Saved Successfully!"
        message={`${confirmedGoals.length} health goal${confirmedGoals.length !== 1 ? 's' : ''} have been saved. You're one step closer to your best self!`}
        autoCloseDelay={2500}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function GoalSetupHeader() {
  return (
    <motion.div
      className="text-center mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-600/10 border border-sky-600 mb-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Sparkles className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-white/80">AI-Generated Goals</span>
      </motion.div>

      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
        Your Personalized{' '}
        <span className="text-white">
          Goals
        </span>
      </h1>
      <p className="text-slate-400 text-lg max-w-xl mx-auto">
        Based on your assessment, we&apos;ve crafted these goals for you. Confirm the ones
        you&apos;re ready to commit to.
      </p>
    </motion.div>
  );
}
