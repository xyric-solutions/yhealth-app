'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/src/features/onboarding/context/OnboardingContext';
import { useOnboardingApi } from '../hooks/useOnboardingApi';
import { useAuth } from '@/app/context/AuthContext';
import { usePlanGeneration } from '../hooks/usePlanGeneration';
import { SuccessModal } from '@/components/common/success-modal';
import {
  GeneratingView,
  PlanReadyView,
  GENERATION_PHASES,
  MOCK_PLAN,
} from '../components/plan';

/**
 * PlanGenerationStep - AI-powered plan generation and launch
 *
 * Features:
 * - Visual progress phases during generation
 * - Comprehensive AI analysis of goals, MCQs, body stats, images
 * - Generates personalized diet AND workout plans
 * - Coach message based on preference
 * - Onboarding completion flow
 */
export function PlanGenerationStep() {
  const {
    preferences,
    confirmedGoals,
    setGeneratedPlan,
    acceptPlan,
    selectedGoal,
    customGoalText,
    assessmentResponses,
    bodyStats,
    bodyImages,
    planDurationWeeks,
    dietPreferences,
  } = useOnboarding();
  const { generatePlan, generateOnboardingPlans, completeOnboarding, analyzeAllBodyImages } = useOnboardingApi();
  const { refreshUser } = useAuth();
  const router = useRouter();

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Prepare comprehensive onboarding data for AI analysis
  const onboardingData = useMemo(() => {
    // Determine which body images have been uploaded
    const uploadedImages = Object.entries(bodyImages || {})
      .filter(([key, img]) => key !== 'privacyConsent' && key !== 'skipped' && img && typeof img === 'object' && 'uploadKey' in img && img.uploadKey)
      .map(([key]) => key);

    return {
      selectedGoal: selectedGoal || '',
      customGoalText: customGoalText || undefined,
      confirmedGoals: confirmedGoals.map((g) => ({
        // eslint-disable-next-line react-hooks/purity
        id: g.id || `goal-${Date.now()}`,
        category: String(g.category),
        pillar: String(g.pillar),
        title: g.title,
        description: g.description,
        targetValue: g.targetValue,
        targetUnit: g.targetUnit,
        motivation: g.motivation,
        confidenceLevel: g.confidenceLevel,
      })),
      planDurationWeeks: planDurationWeeks || 4,
      bodyStats: bodyStats as Record<string, number>,
      assessmentResponses: assessmentResponses.map((r) => ({
        questionId: r.questionId,
        questionText: r.questionText || '', // Use stored question text for AI context
        answer: r.value,
        category: r.category, // Use stored category for AI context
      })),
      bodyImagesAnalysis: uploadedImages.length > 0 ? {
        hasImages: true,
        imageTypes: uploadedImages,
        aiAnalysis: undefined, // Will be analyzed on the server
      } : undefined,
      preferences: {
        coachingStyle: preferences?.coachingStyle,
        notificationFrequency: preferences?.coachingIntensity,
        preferredWorkoutTime: undefined, // Can be extracted from preferences if available
        preferredCheckInTime: preferences?.preferredCheckInTime,
      },
      dietPreferences: {
        dietType: dietPreferences?.dietType || 'standard',
        allergies: dietPreferences?.allergies || [],
        excludedFoods: dietPreferences?.excludedFoods || [],
        mealsPerDay: dietPreferences?.mealsPerDay || 3,
        mealTimes: dietPreferences?.mealTimes || {
          breakfast: '08:00',
          lunch: '12:30',
          dinner: '19:00',
        },
      },
      userProfile: undefined, // Will be filled from server-side user data
    };
  }, [
    selectedGoal,
    customGoalText,
    confirmedGoals,
    planDurationWeeks,
    bodyStats,
    assessmentResponses,
    bodyImages,
    preferences,
    dietPreferences,
  ]);

  const {
    currentPhaseIndex,
    isGenerating,
    showPlan,
    generatedPlanData,
    coachMessage,
    planSource,
  } = usePlanGeneration({
    confirmedGoals,
    preferences,
    generatePlanApi: generatePlan,
    generateOnboardingPlansApi: generateOnboardingPlans,
    analyzeAllBodyImagesApi: analyzeAllBodyImages,
    onboardingData,
    setGeneratedPlan,
  });

  const handleStartPlan = useCallback(async () => {
    setIsStarting(true);
    setStartError(null);

    try {
      // Call API to complete onboarding - this updates user.onboarding_status to 'completed'
      await completeOnboarding();

      // Update local state
      acceptPlan();

      // Refresh user data to get updated onboarding status
      await refreshUser();

      // Show success modal
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setStartError('Failed to start your plan. Please try again.');
      setIsStarting(false);
    }
  }, [completeOnboarding, acceptPlan, refreshUser]);

  // Handle success modal close - navigate to dashboard
  const handleSuccessModalClose = useCallback(() => {
    setShowSuccessModal(false);
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <GeneratingView
            key="generating"
            phases={GENERATION_PHASES}
            currentPhaseIndex={currentPhaseIndex}
          />
        ) : showPlan ? (
          <PlanReadyView
            key="plan"
            plan={generatedPlanData || MOCK_PLAN}
            goals={confirmedGoals}
            coachMessage={coachMessage}
            onStartPlan={handleStartPlan}
            isStarting={isStarting}
            error={startError}
            planSource={planSource}
          />
        ) : (
          <TransitionState key="transition" />
        )}
      </AnimatePresence>

      {/* Success Modal for Onboarding Completion */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        type="onboarding"
        title="You're All Set!"
        message="Your personalized health journey begins now. Let's make great things happen together!"
        autoCloseDelay={3000}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function TransitionState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center min-h-[400px]"
    >
      <Sparkles className="w-12 h-12 text-sky-500 animate-pulse" />
    </motion.div>
  );
}
