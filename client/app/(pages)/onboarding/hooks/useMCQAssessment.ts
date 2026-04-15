'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  aiCoachService,
  type SupportedLanguage,
  type MCQQuestion,
  type MCQOption,
  type ExtractedInsight,
  type ConversationPhase,
} from '@/src/shared/services';
import {
  type DisplayInsight,
  mapInsightToDisplay,
  type AICoachGoalCategory,
  GOAL_MAP,
} from '../steps/deep-assessment';

interface UseMCQAssessmentOptions {
  selectedGoal: string | null;
  onAddAssessmentResponse: (response: { questionId: string; value: string | number | string[] }) => void;
}

interface UseMCQAssessmentReturn {
  // State
  currentQuestion: MCQQuestion | null;
  selectedOptions: MCQOption[];
  isLoading: boolean;
  isSubmitting: boolean;
  progress: number;
  conversationComplete: boolean;
  currentPhase: ConversationPhase;
  extractedInsights: ExtractedInsight[];
  displayInsights: DisplayInsight[];
  error: string | null;
  aiAvailable: boolean | null;
  language: SupportedLanguage;
  questionCount: number;
  sessionId: string | null;

  // Actions
  setLanguage: (lang: SupportedLanguage) => void;
  toggleOption: (option: MCQOption) => void;
  submitAnswer: () => Promise<void>;
  retryQuestion: () => void;
  resetAssessment: () => void;
}

export function useMCQAssessment({
  selectedGoal,
  onAddAssessmentResponse,
}: UseMCQAssessmentOptions): UseMCQAssessmentReturn {
  const [currentQuestion, setCurrentQuestion] = useState<MCQQuestion | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<MCQOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('opening');
  const [extractedInsights, setExtractedInsights] = useState<ExtractedInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [previousAnswers, setPreviousAnswers] = useState<{ questionId: string; questionText?: string; selectedOptions: string[] }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const hasInitializedRef = useRef(false);

  const apiGoal: AICoachGoalCategory = GOAL_MAP[selectedGoal || 'custom'] || 'custom';

  const questionCount = useMemo(() => previousAnswers.length, [previousAnswers]);

  const displayInsights = useMemo(
    () => extractedInsights.slice(0, 6).map((insight, i) => mapInsightToDisplay(insight, i)),
    [extractedInsights]
  );

  // Check AI availability on mount
  useEffect(() => {
    aiCoachService.checkStatus().then((status) => {
      setAiAvailable(status.available);
      if (!status.available) {
        setError('AI Coach is not available. Please try again later.');
      }
    });
  }, []);

  // Generate first question and create session on mount
  useEffect(() => {
    if (hasInitializedRef.current || aiAvailable === null || !aiAvailable) return;
    hasInitializedRef.current = true;

    const initializeAssessment = async () => {
      setIsLoading(true);
      try {
        // Create a session for MCQ assessment to persist chat history
        const sessionResponse = await aiCoachService.getOrCreateSession(apiGoal, 'mcq_assessment');
        const session = sessionResponse.session;
        setSessionId(session.id);

        // If session has existing data, restore it
        if (session.extractedInsights && session.extractedInsights.length > 0) {
          setExtractedInsights(session.extractedInsights);
        }
        if (session.conversationPhase) {
          setCurrentPhase(session.conversationPhase);
        }

        // Generate first question
        const response = await aiCoachService.generateMCQQuestion({
          goal: apiGoal,
          phase: 'opening',
          previousAnswers: [],
          extractedInsights: session.extractedInsights || [],
          language,
        });

        setCurrentQuestion(response.question);
        setCurrentPhase(response.phase);
        setProgress(response.progress);
        setError(null);

        if (response.isComplete) {
          setConversationComplete(true);
        }
      } catch (err) {
        console.error('Failed to initialize MCQ assessment:', err);
        setError('Failed to load questions. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAssessment();
  }, [apiGoal, aiAvailable, language]);

  const toggleOption = useCallback((option: MCQOption) => {
    setSelectedOptions((prev) => {
      const isSelected = prev.some((o) => o.id === option.id);
      if (isSelected) {
        return prev.filter((o) => o.id !== option.id);
      }
      // If allowMultiple is false, replace selection
      if (!currentQuestion?.allowMultiple) {
        return [option];
      }
      return [...prev, option];
    });
  }, [currentQuestion?.allowMultiple]);

  const submitAnswer = useCallback(async () => {
    if (selectedOptions.length === 0 || !currentQuestion || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Process the answer to extract insights (fast, no AI call)
      const answerResponse = await aiCoachService.processMCQAnswer({
        questionId: currentQuestion.id,
        selectedOptions,
        goal: apiGoal,
      });

      // Update insights
      const newInsights = [...extractedInsights, ...answerResponse.insights];
      setExtractedInsights(newInsights);

      // Record the answer
      const newAnswer = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.question,
        selectedOptions: selectedOptions.map((o) => o.text),
      };
      const updatedAnswers = [...previousAnswers, newAnswer];
      setPreviousAnswers(updatedAnswers);

      // Add to onboarding responses
      onAddAssessmentResponse({
        questionId: `mcq_${currentQuestion.id}`,
        value: selectedOptions.map((o) => o.text),
      });

      // Clear selection immediately for snappier UX
      setSelectedOptions([]);
      setIsLoading(true);

      // Fire-and-forget: persist to chat history (non-blocking)
      if (sessionId) {
        aiCoachService.chat(
          `[MCQ Answer] Q: ${currentQuestion.question} → ${selectedOptions.map((o) => o.text).join(', ')}`,
          apiGoal,
          sessionId
        ).catch((chatErr) => console.warn('Failed to persist MCQ to chat history:', chatErr));
      }

      // Critical path: generate next question (this is what the user waits for)
      const nextResponse = await aiCoachService.generateMCQQuestion({
        goal: apiGoal,
        phase: currentPhase,
        previousAnswers: updatedAnswers,
        extractedInsights: newInsights,
        language,
      });

      setCurrentQuestion(nextResponse.question);
      setCurrentPhase(nextResponse.phase);
      setProgress(nextResponse.progress);

      if (nextResponse.isComplete) {
        setConversationComplete(true);
        setExtractedInsights(nextResponse.insights);
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to process your answer. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  }, [
    selectedOptions,
    currentQuestion,
    isSubmitting,
    apiGoal,
    extractedInsights,
    previousAnswers,
    currentPhase,
    language,
    onAddAssessmentResponse,
    sessionId,
  ]);

  const retryQuestion = useCallback(() => {
    if (!aiAvailable) return;

    setError(null);
    setIsLoading(true);

    aiCoachService
      .generateMCQQuestion({
        goal: apiGoal,
        phase: currentPhase,
        previousAnswers,
        extractedInsights,
        language,
      })
      .then((response) => {
        setCurrentQuestion(response.question);
        setCurrentPhase(response.phase);
        setProgress(response.progress);
      })
      .catch((err) => {
        console.error('Failed to retry question:', err);
        setError('Failed to load question. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [aiAvailable, apiGoal, currentPhase, previousAnswers, extractedInsights, language]);

  const resetAssessment = useCallback(() => {
    hasInitializedRef.current = false;
    setCurrentQuestion(null);
    setSelectedOptions([]);
    setProgress(0);
    setConversationComplete(false);
    setCurrentPhase('opening');
    setExtractedInsights([]);
    setPreviousAnswers([]);
    setError(null);
    setAiAvailable(null);
    setSessionId(null);

    // Re-check AI and start fresh
    aiCoachService.checkStatus().then((status) => {
      setAiAvailable(status.available);
    });
  }, []);

  return {
    // State
    currentQuestion,
    selectedOptions,
    isLoading,
    isSubmitting,
    progress,
    conversationComplete,
    currentPhase,
    extractedInsights,
    displayInsights,
    error,
    aiAvailable,
    language,
    questionCount,
    sessionId,

    // Actions
    setLanguage,
    toggleOption,
    submitAnswer,
    retryQuestion,
    resetAssessment,
  };
}
