'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dumbbell, Utensils, Moon, Brain, Calendar } from 'lucide-react';
import type { Goal } from '@/src/types';
import type { GeneratedPlan, WeeklyFocus } from '../components/plan/types';
import { GENERATION_PHASES, MOCK_PLAN, COACH_MESSAGES } from '../components/plan/constants';

// Types for onboarding data passed to AI
interface OnboardingDataForAI {
  selectedGoal: string;
  customGoalText?: string;
  confirmedGoals: Array<{
    id: string;
    category: string;
    pillar: string;
    title: string;
    description: string;
    targetValue?: number;
    targetUnit?: string;
    motivation?: string;
    confidenceLevel?: number;
  }>;
  planDurationWeeks: number;
  bodyStats: Record<string, number>;
  assessmentResponses: Array<{
    questionId: string;
    questionText: string;
    answer: string | string[] | number;
    category?: string;
  }>;
  bodyImagesAnalysis?: {
    hasImages: boolean;
    imageTypes: string[];
    aiAnalysis?: Record<string, object>;
  };
  preferences: {
    coachingStyle?: string;
    notificationFrequency?: string;
    preferredWorkoutTime?: string;
    preferredCheckInTime?: string;
  };
  dietPreferences: {
    dietType: string;
    allergies: string[];
    excludedFoods: string[];
    mealsPerDay: number;
    mealTimes: Record<string, string>;
  };
  userProfile?: {
    gender?: string;
    dateOfBirth?: string;
    age?: number;
  };
}

// Response from generateOnboardingPlans API
interface OnboardingPlansResponse {
  dietPlan: {
    id: string;
    name: string;
    description: string;
    goalCategory: string;
    dailyCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
    mealsPerDay: number;
    snacksPerDay: number;
    mealTimes: Record<string, string>;
    weeklyMeals: Record<string, Record<string, string>>;
    tips: string[];
    aiRationale: string;
  };
  workoutPlan: {
    id: string;
    name: string;
    description: string;
    goalCategory: string;
    durationWeeks: number;
    workoutsPerWeek: number;
    workoutLocation: string;
    fitnessLevel: string;
    weeklySchedule: Record<string, unknown>;
    tips: string[];
    aiRationale: string;
  };
  overallAnalysis: {
    healthScore: number;
    riskFactors: string[];
    recommendations: string[];
    motivationalMessage: string;
  };
  provider: string;
}

interface UsePlanGenerationOptions {
  confirmedGoals: Goal[];
  preferences: { coachingStyle: string };
  generatePlanApi: (goalId?: string) => Promise<{ plan?: unknown } | undefined>;
  generateOnboardingPlansApi?: (data?: OnboardingDataForAI) => Promise<OnboardingPlansResponse | undefined>;
  analyzeAllBodyImagesApi?: () => Promise<unknown>;
  onboardingData?: OnboardingDataForAI;
  setGeneratedPlan: (plan: GeneratedPlan) => void;
}

// Plan source type - indicates where the plan came from
export type PlanSource = 'ai' | 'fallback' | 'mock';

interface UsePlanGenerationReturn {
  // State
  currentPhaseIndex: number;
  isGenerating: boolean;
  planReady: boolean;
  showPlan: boolean;
  generatedPlanData: GeneratedPlan | null;
  error: string | null;
  coachMessage: string;
  /** Indicates the source of the generated plan: 'ai' | 'fallback' | 'mock' */
  planSource: PlanSource;

  // Actions
  runPlanGeneration: () => Promise<void>;
}

// Activity icon helper
function getActivityIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    workout: <Dumbbell className="w-5 h-5" />,
    nutrition: <Utensils className="w-5 h-5" />,
    meal: <Utensils className="w-5 h-5" />,
    sleep_routine: <Moon className="w-5 h-5" />,
    wellbeing: <Moon className="w-5 h-5" />,
    mindfulness: <Brain className="w-5 h-5" />,
    check_in: <Brain className="w-5 h-5" />,
  };
  return icons[type] || <Calendar className="w-5 h-5" />;
}

/**
 * usePlanGeneration - Custom hook for managing plan generation state and API calls
 *
 * Features:
 * - Visual progress phases during generation
 * - API call with fallback to mock data
 * - Coach message based on style preference
 */
export function usePlanGeneration({
  confirmedGoals,
  preferences,
  generatePlanApi,
  generateOnboardingPlansApi,
  analyzeAllBodyImagesApi,
  onboardingData,
  setGeneratedPlan,
}: UsePlanGenerationOptions): UsePlanGenerationReturn {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [planReady, setPlanReady] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [generatedPlanData, setGeneratedPlanData] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planSource, setPlanSource] = useState<PlanSource>('mock');

  // Prevent duplicate API calls (React Strict Mode / fast re-renders)
  const hasStartedRef = useRef(false);

  const coachMessage = COACH_MESSAGES[preferences.coachingStyle] || COACH_MESSAGES.supportive;

  const runPlanGeneration = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    let phaseIndex = 0;

    try {
      // Run visual phases while making API call
      const phasePromise = (async () => {
        for (const phase of GENERATION_PHASES) {
          setCurrentPhaseIndex(phaseIndex);
          await new Promise((resolve) => setTimeout(resolve, phase.duration));
          phaseIndex++;
        }
      })();

      // Try the new comprehensive AI-powered plan generation first
      let apiResult: { plan?: unknown } | undefined;
      let onboardingPlansResult: OnboardingPlansResponse | undefined;

      if (generateOnboardingPlansApi) {
        // Use the comprehensive AI-powered onboarding plans API
        console.log('[PlanGeneration] Using AI-powered onboarding plans API...');
        console.log('[PlanGeneration] Onboarding data being sent:', JSON.stringify(onboardingData, null, 2));
        
        // Analyze body images if they exist (fire and forget - don't wait)
        if (onboardingData?.bodyImagesAnalysis?.hasImages && analyzeAllBodyImagesApi) {
          // Trigger analysis (non-blocking)
          analyzeAllBodyImagesApi().catch((err) => {
            console.warn('[PlanGeneration] Body image analysis failed, continuing with plan generation', err);
          });
        }
        
        try {
          onboardingPlansResult = await generateOnboardingPlansApi(onboardingData);
          console.log('[PlanGeneration] AI plans generated successfully:', onboardingPlansResult);
        } catch (aiError) {
          console.error('[PlanGeneration] AI plan generation FAILED:', aiError);
          console.error('[PlanGeneration] Error details:', aiError instanceof Error ? aiError.message : String(aiError));
          // Still fall back to basic plan
        }
      }

      // Fallback to basic plan generation if AI plans fail
      if (!onboardingPlansResult) {
        const primaryGoal = confirmedGoals.find((g) => g.isPrimary) || confirmedGoals[0];
        apiResult = await generatePlanApi(primaryGoal?.id);
      }

      // Wait for visual phases to complete
      await phasePromise;

      // Use AI-generated plans if available
      if (onboardingPlansResult) {
        const { dietPlan, workoutPlan, overallAnalysis } = onboardingPlansResult;

        // Create activities from both diet and workout plans
        const activities = [];

        // Add workout activities from weekly schedule
        if (workoutPlan?.weeklySchedule) {
          const days = Object.keys(workoutPlan.weeklySchedule).slice(0, 5);
          for (const day of days) {
            const daySchedule = workoutPlan.weeklySchedule[day] as { type?: string; name?: string; duration?: string };
            if (daySchedule && daySchedule.type !== 'rest') {
              activities.push({
                id: `workout-${day}`,
                type: 'workout',
                title: daySchedule.name || 'Workout',
                description: `${daySchedule.duration || '30 minutes'} session`,
                days: [day.charAt(0).toUpperCase() + day.slice(1)],
                time: '9:00 AM',
                icon: getActivityIcon('workout'),
              });
            }
          }
        }

        // Add meal activities
        if (dietPlan?.mealsPerDay) {
          activities.push({
            id: 'meals',
            type: 'meal',
            title: `${dietPlan.mealsPerDay} Balanced Meals`,
            description: `${dietPlan.dailyCalories || 2000} calories, ${dietPlan.proteinGrams || 100}g protein`,
            days: ['Daily'],
            time: dietPlan.mealTimes?.breakfast || '8:00 AM',
            icon: getActivityIcon('meal'),
          });
        }

        // Add check-in activity
        activities.push({
          id: 'checkin',
          type: 'check_in',
          title: 'Daily Check-in',
          description: 'Track progress and stay accountable',
          days: ['Daily'],
          time: '8:00 PM',
          icon: getActivityIcon('check_in'),
        });

        // Create weekly focuses from analysis
        const weeklyFocuses: WeeklyFocus[] = [];
        if (workoutPlan?.durationWeeks) {
          const focusAreas = ['Foundation', 'Building Strength', 'Progression', 'Peak Performance'];
          const themeAreas = ['Getting Started', 'Building Momentum', 'Pushing Limits', 'Achieving Goals'];
          for (let i = 1; i <= Math.min(workoutPlan.durationWeeks, 4); i++) {
            weeklyFocuses.push({
              week: i,
              theme: themeAreas[i - 1] || 'Consistency',
              focus: focusAreas[i - 1] || 'Maintenance',
            });
          }
        }

        const planData: GeneratedPlan = {
          name: workoutPlan?.name || dietPlan?.name || 'Your Personalized Health Plan',
          description: overallAnalysis?.motivationalMessage || dietPlan?.aiRationale || workoutPlan?.aiRationale || 'AI-generated plan tailored to your goals',
          activities: activities.length > 0 ? activities : MOCK_PLAN.activities,
          weeklyFocuses: weeklyFocuses.length > 0 ? weeklyFocuses : MOCK_PLAN.weeklyFocuses,
          milestones: MOCK_PLAN.milestones, // Use default milestones
        };

        console.log('[PlanGeneration] Created plan data from AI:', planData);
        setGeneratedPlanData(planData);
        setGeneratedPlan(planData);
        setPlanSource('ai');
      } else if (apiResult?.plan) {
        // Use basic API result
        interface ApiActivity {
          id: string;
          type: string;
          title: string;
          description: string;
          days?: string[];
          preferredTime?: string;
        }

        const apiPlan = apiResult.plan as {
          name?: string;
          description?: string;
          activities?: ApiActivity[];
          weeklyFocuses?: WeeklyFocus[];
        };

        const planData: GeneratedPlan = {
          ...MOCK_PLAN,
          name: apiPlan.name || MOCK_PLAN.name,
          description: apiPlan.description || MOCK_PLAN.description,
          activities:
            apiPlan.activities && apiPlan.activities.length > 0
              ? apiPlan.activities.map((a) => ({
                  id: a.id,
                  type: a.type,
                  title: a.title,
                  description: a.description,
                  days: a.days || ['Daily'],
                  time: a.preferredTime || '9:00 AM',
                  icon: getActivityIcon(a.type),
                }))
              : MOCK_PLAN.activities,
          weeklyFocuses:
            apiPlan.weeklyFocuses && apiPlan.weeklyFocuses.length > 0
              ? apiPlan.weeklyFocuses
              : MOCK_PLAN.weeklyFocuses,
        };
        setGeneratedPlanData(planData);
        setGeneratedPlan(planData);
        setPlanSource('fallback');
      } else {
        // Fallback to mock plan if API doesn't return data
        console.warn('[PlanGeneration] Using mock plan - no API data returned');
        setGeneratedPlanData(MOCK_PLAN);
        setGeneratedPlan(MOCK_PLAN);
        setPlanSource('mock');
      }

      setIsGenerating(false);
      setPlanReady(true);
      setTimeout(() => setShowPlan(true), 500);
    } catch (err) {
      console.error('[PlanGeneration] Plan generation error:', err);
      setError(err instanceof Error ? err.message : 'Plan generation failed');
      // On error, still show mock plan to not block user
      setGeneratedPlanData(MOCK_PLAN);
      setGeneratedPlan(MOCK_PLAN);
      setPlanSource('mock');
      setIsGenerating(false);
      setPlanReady(true);
      setTimeout(() => setShowPlan(true), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedGoals, generatePlanApi, generateOnboardingPlansApi, onboardingData, setGeneratedPlan]);

  // Start plan generation on mount (only once)
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    runPlanGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    currentPhaseIndex,
    isGenerating,
    planReady,
    showPlan,
    generatedPlanData,
    error,
    coachMessage,
    planSource,

    // Actions
    runPlanGeneration,
  };
}
