'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Goal } from '@/src/types';
import {
  aiCoachService,
  type GeneratedGoal,
  type AICoachGoalCategory,
} from '@/src/shared/services/ai-coach.service';

interface UseGoalSetupOptions {
  selectedGoal: string | null;
  customGoalText: string | null;
  assessmentResponses: Array<{ questionId: string; value: string | number | string[] }>;
  bodyStats: {
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    bodyFatPercentage?: number;
    age?: number;
    gender?: string;
  };
  suggestedGoals: Goal[];
  confirmedGoals: Goal[];
  setSuggestedGoals: (goals: Goal[]) => void;
  confirmGoal: (goal: Goal) => void;
  removeGoal: (goalId: string) => void;
  updateGoalConfidence: (goalId: string, confidence: number) => void;
}

interface UseGoalSetupReturn {
  // State
  expandedGoal: string | null;
  confidenceValues: Record<string, number>;
  editingGoal: string | null;
  editedGoals: Record<string, Partial<Goal>>;
  isGenerating: boolean;
  error: string | null;
  aiReasoning: string | null;

  // Actions
  setExpandedGoal: (goalId: string | null) => void;
  handleToggleGoal: (goal: Goal) => void;
  handleConfidenceChange: (goalId: string, value: number) => void;
  handleStartEdit: (goal: Goal) => void;
  handleCancelEdit: () => void;
  handleSaveEdit: (goalId: string) => void;
  handleEditChange: (goalId: string, field: string, value: number | string) => void;
  handleTimelineChange: (goalId: string, weeks: number) => void;
  handleRegenerateGoals: () => Promise<void>;
}

function convertToGoal(generatedGoal: GeneratedGoal): Goal {
  return {
    id: generatedGoal.id || crypto.randomUUID(),
    category: generatedGoal.category,
    pillar: generatedGoal.pillar,
    isPrimary: generatedGoal.isPrimary,
    title: generatedGoal.title,
    description: generatedGoal.description,
    targetValue: generatedGoal.targetValue,
    targetUnit: generatedGoal.targetUnit,
    currentValue: generatedGoal.currentValue,
    timeline: {
      startDate: new Date(generatedGoal.timeline.startDate),
      targetDate: new Date(generatedGoal.timeline.targetDate),
      durationWeeks: generatedGoal.timeline.durationWeeks,
    },
    motivation: generatedGoal.motivation,
    confidenceLevel: Math.round(generatedGoal.confidenceScore * 10),
    aiSuggested: generatedGoal.aiSuggested,
  };
}

export function useGoalSetup({
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
}: UseGoalSetupOptions): UseGoalSetupReturn {
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [confidenceValues, setConfidenceValues] = useState<Record<string, number>>({});
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editedGoals, setEditedGoals] = useState<Record<string, Partial<Goal>>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Generate AI-powered goals on mount
  useEffect(() => {
    const generateAIGoals = async () => {
      if (suggestedGoals.length > 0 || !selectedGoal || isGenerating) {
        return;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const response = await aiCoachService.generateGoals({
          goalCategory: selectedGoal as AICoachGoalCategory,
          assessmentResponses: assessmentResponses.map((r) => ({
            questionId: r.questionId,
            value: r.value,
          })),
          bodyStats: {
            heightCm: bodyStats.heightCm,
            weightKg: bodyStats.weightKg,
            targetWeightKg: bodyStats.targetWeightKg,
            bodyFatPercentage: bodyStats.bodyFatPercentage,
            age: bodyStats.age,
            gender: bodyStats.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
          },
          customGoalText: customGoalText || undefined,
        });

        const goals = response.goals.map(convertToGoal);
        setSuggestedGoals(goals);
        setAiReasoning(response.reasoning);

        // Auto-confirm the primary goal
        const primaryGoal = goals.find((g) => g.isPrimary);
        if (primaryGoal) {
          confirmGoal(primaryGoal);
          setConfidenceValues({ [primaryGoal.id!]: primaryGoal.confidenceLevel || 7 });
        }
      } catch (err) {
        console.error('Failed to generate goals:', err);
        setError('Failed to generate personalized goals. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    };

    generateAIGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGoal]);

  const handleRegenerateGoals = useCallback(async () => {
    if (!selectedGoal || isGenerating) return;

    // Clear existing goals
    setSuggestedGoals([]);
    confirmedGoals.forEach((g) => removeGoal(g.id!));
    setConfidenceValues({});
    setAiReasoning(null);
    setIsGenerating(true);
    setError(null);

    try {
      const response = await aiCoachService.generateGoals({
        goalCategory: selectedGoal as AICoachGoalCategory,
        assessmentResponses: assessmentResponses.map((r) => ({
          questionId: r.questionId,
          value: r.value,
        })),
        bodyStats: {
          heightCm: bodyStats.heightCm,
          weightKg: bodyStats.weightKg,
          targetWeightKg: bodyStats.targetWeightKg,
          bodyFatPercentage: bodyStats.bodyFatPercentage,
          age: bodyStats.age,
          gender: bodyStats.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
        },
        customGoalText: customGoalText || undefined,
      });

      const goals = response.goals.map(convertToGoal);
      setSuggestedGoals(goals);
      setAiReasoning(response.reasoning);

      // Auto-confirm the primary goal
      const primaryGoal = goals.find((g) => g.isPrimary);
      if (primaryGoal) {
        confirmGoal(primaryGoal);
        setConfidenceValues({ [primaryGoal.id!]: primaryGoal.confidenceLevel || 7 });
      }
    } catch (err) {
      console.error('Failed to regenerate goals:', err);
      setError('Failed to regenerate goals. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedGoal,
    isGenerating,
    assessmentResponses,
    bodyStats,
    customGoalText,
    setSuggestedGoals,
    confirmedGoals,
    removeGoal,
    confirmGoal,
  ]);

  const handleToggleGoal = useCallback(
    (goal: Goal) => {
      if (!goal.id) {
        console.error('Goal missing ID:', goal);
        return;
      }
      
      const isConfirmed = confirmedGoals.some((g) => g.id && goal.id && g.id === goal.id);
      if (isConfirmed) {
        removeGoal(goal.id);
      } else {
        confirmGoal(goal);
        setConfidenceValues((prev) => ({ ...prev, [goal.id as string]: goal.confidenceLevel || 7 }));
      }
    },
    [confirmedGoals, confirmGoal, removeGoal]
  );

  const handleConfidenceChange = useCallback(
    (goalId: string, value: number) => {
      setConfidenceValues((prev) => ({ ...prev, [goalId]: value }));
      updateGoalConfidence(goalId, value);
    },
    [updateGoalConfidence]
  );

  const handleStartEdit = useCallback((goal: Goal) => {
    setEditingGoal(goal.id!);
    setEditedGoals((prev) => ({
      ...prev,
      [goal.id!]: {
        targetValue: goal.targetValue,
        timeline: goal.timeline,
        motivation: goal.motivation,
      },
    }));
    setExpandedGoal(goal.id!);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingGoal(null);
  }, []);

  const handleSaveEdit = useCallback(
    (goalId: string) => {
      const goal = suggestedGoals.find((g) => g.id === goalId);
      if (goal && editedGoals[goalId]) {
        const updatedGoal: Goal = {
          ...goal,
          targetValue: editedGoals[goalId].targetValue ?? goal.targetValue,
          timeline: editedGoals[goalId].timeline ?? goal.timeline,
          motivation: editedGoals[goalId].motivation ?? goal.motivation,
        };
        setSuggestedGoals(suggestedGoals.map((g) => (g.id === goalId ? updatedGoal : g)));
        if (confirmedGoals.some((g) => g.id === goalId)) {
          confirmGoal(updatedGoal);
        }
      }
      setEditingGoal(null);
    },
    [suggestedGoals, editedGoals, confirmedGoals, setSuggestedGoals, confirmGoal]
  );

  const handleEditChange = useCallback(
    (goalId: string, field: string, value: number | string) => {
      setEditedGoals((prev) => ({
        ...prev,
        [goalId]: {
          ...prev[goalId],
          [field]: value,
        },
      }));
    },
    []
  );

  const handleTimelineChange = useCallback(
    (goalId: string, weeks: number) => {
      const goal = suggestedGoals.find((g) => g.id === goalId);
      if (goal) {
        const newTargetDate = new Date();
        newTargetDate.setDate(newTargetDate.getDate() + weeks * 7);
        setEditedGoals((prev) => ({
          ...prev,
          [goalId]: {
            ...prev[goalId],
            timeline: {
              ...goal.timeline,
              durationWeeks: weeks,
              targetDate: newTargetDate,
            },
          },
        }));
      }
    },
    [suggestedGoals]
  );

  return {
    // State
    expandedGoal,
    confidenceValues,
    editingGoal,
    editedGoals,
    isGenerating,
    error,
    aiReasoning,

    // Actions
    setExpandedGoal,
    handleToggleGoal,
    handleConfidenceChange,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditChange,
    handleTimelineChange,
    handleRegenerateGoals,
  };
}
