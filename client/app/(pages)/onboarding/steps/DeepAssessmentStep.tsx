'use client';

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from '@/src/features/onboarding/context/OnboardingContext';
import { useDeepAssessment } from '../hooks/useDeepAssessment';
import { useMCQAssessment } from '../hooks/useMCQAssessment';
import {
  ChatBubble,
  ChatInput,
  ChatHeader,
  CompletionView,
  ErrorBanner,
  AdvancedTypingIndicator,
  MCQQuestionCard,
  type AssessmentInteractionMode,
} from './deep-assessment';

/**
 * DeepAssessmentStep - AI-powered conversational health assessment
 *
 * Features:
 * - Real-time AI conversation with health coach (Q&A mode)
 * - Dynamic AI-generated MCQ questions (MCQ mode)
 * - Voice input via Web Speech API
 * - Image upload and analysis (food, body, medical docs)
 * - Multi-language support (EN/UR)
 * - Session persistence and resumption
 * - Insight extraction and display
 */
export function DeepAssessmentStep() {
  const [interactionMode, setInteractionMode] = useState<AssessmentInteractionMode>('mcq');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const {
    selectedGoal,
    prevStep,
    nextStep,
    goToStep,
    setAssessmentMode,
    addAssessmentResponse,
    completeAssessment,
  } = useOnboarding();

  // Q&A Mode Hook
  const qaAssessment = useDeepAssessment({
    selectedGoal,
    onAddAssessmentResponse: addAssessmentResponse,
  });

  // Destructure values to avoid ref access during render
  const {
    inputValue: qaInputValue,
    setInputValue: qaSetInputValue,
    sendMessage: qaSendMessage,
    uploadImage: qaUploadImage,
    isTyping: qaIsTyping,
    isUploading: qaIsUploading,
    aiAvailable: qaAiAvailable,
    messages: qaMessages,
    error: qaError,
    conversationComplete: qaConversationComplete,
    displayInsights: qaDisplayInsights,
    currentPhase: qaCurrentPhase,
    extractedInsights: qaExtractedInsights,
    language: qaLanguage,
    userMessageCount: qaUserMessageCount,
    setLanguage: qaSetLanguage,
    resetLanguage: qaResetLanguage,
    retryLastMessage: qaRetryLastMessage,
    retryInit: qaRetryInit,
    regenerateMessage: qaRegenerateMessage,
    messagesEndRef: qaMessagesEndRef,
  } = qaAssessment;

  // MCQ Mode Hook
  const mcqAssessment = useMCQAssessment({
    selectedGoal,
    onAddAssessmentResponse: addAssessmentResponse,
  });

  // Determine which mode's state to use
  const isQAMode = interactionMode === 'qa';
  const currentError = isQAMode ? qaError : mcqAssessment.error;
  const currentComplete = isQAMode ? qaConversationComplete : mcqAssessment.conversationComplete;
  const currentInsights = isQAMode ? qaDisplayInsights : mcqAssessment.displayInsights;
  const currentPhase = isQAMode ? qaCurrentPhase : mcqAssessment.currentPhase;
  const extractedInsights = isQAMode ? qaExtractedInsights : mcqAssessment.extractedInsights;
  const currentLanguage = isQAMode ? qaLanguage : mcqAssessment.language;
  const currentProgress = isQAMode ? qaUserMessageCount : mcqAssessment.questionCount;
  const canChangeLanguage = isQAMode ? qaMessages.length <= 1 : mcqAssessment.questionCount === 0;

  const handleSwitchToQuick = useCallback(() => {
    setAssessmentMode('quick');
    goToStep(2);
  }, [setAssessmentMode, goToStep]);

  const handleModeChange = useCallback((mode: AssessmentInteractionMode) => {
    // Only allow mode change if no progress made
    if (isQAMode && qaMessages.length <= 1) {
      setInteractionMode(mode);
    } else if (!isQAMode && mcqAssessment.questionCount === 0) {
      setInteractionMode(mode);
    }
  }, [isQAMode, qaMessages.length, mcqAssessment.questionCount]);

  const handleCompleteAssessment = useCallback(() => {
    if (isQAMode) {
      addAssessmentResponse({
        questionId: 'deep_assessment_conversation',
        value: JSON.stringify({
          mode: 'qa',
          messages: qaMessages.map((m) => ({
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp instanceof Date && !isNaN(m.timestamp.getTime())
              ? m.timestamp.toISOString()
              : new Date().toISOString(),
          })),
          insights: extractedInsights,
          phase: currentPhase,
        }),
      });
    } else {
      addAssessmentResponse({
        questionId: 'deep_assessment_mcq',
        value: JSON.stringify({
          mode: 'mcq',
          insights: extractedInsights,
          phase: currentPhase,
          questionsAnswered: mcqAssessment.questionCount,
        }),
      });
    }

    completeAssessment();
    nextStep();
  }, [
    isQAMode,
    qaMessages,
    extractedInsights,
    currentPhase,
    mcqAssessment.questionCount,
    addAssessmentResponse,
    completeAssessment,
    nextStep,
  ]);

  const handleLanguageChange = useCallback(
     
    (lang: typeof currentLanguage) => {
      if (isQAMode) {
        if (qaMessages.length <= 1) {
          qaResetLanguage(lang);
        } else {
          qaSetLanguage(lang);
        }
      } else {
        mcqAssessment.setLanguage(lang);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isQAMode, qaAssessment, mcqAssessment]
  );

   
  const handleRetry = useCallback(() => {
    if (isQAMode) {
      if (qaMessages.length === 0) {
        qaRetryInit();
      } else {
        qaRetryLastMessage();
      }
    } else {
      mcqAssessment.retryQuestion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQAMode, qaAssessment, mcqAssessment]);

  return (
    <div className="flex flex-col h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <ChatHeader
        userMessageCount={currentProgress}
        language={currentLanguage}
        onLanguageChange={handleLanguageChange}
        onBack={prevStep}
        onSwitchMode={handleSwitchToQuick}
        canChangeLanguage={canChangeLanguage}
        interactionMode={interactionMode}
        onInteractionModeChange={undefined}
        disableQuickMode={mcqAssessment.questionCount > 0}
      />

      {/* Error Banner */}
      {currentError && !currentComplete && (
        <ErrorBanner message={currentError} onRetry={handleRetry} />
      )}

      {/* Main Content Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-88"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.03) 0%, transparent 70%)',
        }}
      >
        <AnimatePresence mode="popLayout">
          {/* Q&A Mode Content */}
          {isQAMode && (
            <>
              {qaMessages.map((message, index) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  isLatest={index === qaMessages.length - 1}
                  onRetry={message.status === 'error' ? qaRetryLastMessage : undefined}
                  onRegenerate={
                    message.sender === 'ai'
                      ? () => qaRegenerateMessage(message.id)
                      : undefined
                  }
                  showActions={!qaIsTyping}
                />
              ))}

              {qaIsTyping && <AdvancedTypingIndicator key="typing" />}
            </>
          )}

          {/* MCQ Mode Content */}
          {!isQAMode && (
            <>
              {mcqAssessment.isLoading && !mcqAssessment.currentQuestion && (
                <motion.div
                  className="flex justify-center py-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <AdvancedTypingIndicator />
                </motion.div>
              )}

              {mcqAssessment.currentQuestion && !currentComplete && (
                <MCQQuestionCard
                  question={mcqAssessment.currentQuestion}
                  selectedOptions={mcqAssessment.selectedOptions}
                  onToggleOption={mcqAssessment.toggleOption}
                  onSubmit={mcqAssessment.submitAnswer}
                  isSubmitting={mcqAssessment.isSubmitting}
                  progress={mcqAssessment.progress}
                />
              )}
            </>
          )}
        </AnimatePresence>

        <div ref={qaMessagesEndRef} />

        {/* Completion View */}
        {currentComplete && (
          <CompletionView insights={currentInsights} onComplete={handleCompleteAssessment} />
        )}
      </div>

      {/* Input Area - Only for Q&A Mode */}
      {isQAMode && !currentComplete && (
        <div className="flex-shrink-0">
          <ChatInput
            value={qaInputValue}
            onChange={qaSetInputValue}
            onSend={qaSendMessage}
            onImageUpload={qaUploadImage}
            disabled={qaIsTyping || !qaAiAvailable}
            isUploading={qaIsUploading}
            placeholder={
              qaAiAvailable
                ? 'Share your thoughts or upload a health image...'
                : 'Connecting to AI Coach...'
            }
          />
        </div>
      )}
    </div>
  );
}
