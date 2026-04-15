'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  aiCoachService,
  type SupportedLanguage,
} from '@/src/shared/services';
import {
  type Message,
  type DisplayInsight,
  type ExtractedInsight,
  type ConversationPhase,
  type AICoachGoalCategory,
  generateMessageId,
  mapInsightToDisplay,
  messagesToChatHistory,
  TARGET_USER_MESSAGES,
  TYPING_INDICATOR_MIN_DELAY,
  GOAL_MAP,
} from '../steps/deep-assessment';

interface UseDeepAssessmentOptions {
  selectedGoal: string | null;
  onAddAssessmentResponse: (response: { questionId: string; value: string | number | string[] }) => void;
}

interface UseDeepAssessmentReturn {
  // State
  messages: Message[];
  inputValue: string;
  isTyping: boolean;
  isUploading: boolean;
  conversationComplete: boolean;
  currentPhase: ConversationPhase;
  extractedInsights: ExtractedInsight[];
  displayInsights: DisplayInsight[];
  error: string | null;
  aiAvailable: boolean | null;
  language: SupportedLanguage;
  sessionId: string | null;
  userMessageCount: number;

  // Actions
  setInputValue: (value: string) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  sendMessage: () => Promise<void>;
  retryLastMessage: () => void;
  retryInit: () => void;
  uploadImage: (file: File) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  resetLanguage: (lang: SupportedLanguage) => void;

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useDeepAssessment({
  selectedGoal,
  onAddAssessmentResponse,
}: UseDeepAssessmentOptions): UseDeepAssessmentReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('opening');
  const [extractedInsights, setExtractedInsights] = useState<ExtractedInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);

  const apiGoal: AICoachGoalCategory = GOAL_MAP[selectedGoal || 'custom'] || 'custom';

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.sender === 'user').length,
    [messages]
  );

  const displayInsights = useMemo(
    () => extractedInsights.slice(0, 6).map((insight, i) => mapInsightToDisplay(insight, i)),
    [extractedInsights]
  );

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Check AI availability on mount
  useEffect(() => {
    aiCoachService.checkStatus().then((status) => {
      setAiAvailable(status.available);
      if (!status.available) {
        setError('AI Coach is not available. Please try again later.');
      }
    });
  }, []);

  // Initialize conversation
  useEffect(() => {
    if (hasInitializedRef.current || aiAvailable === null || !aiAvailable) return;
    hasInitializedRef.current = true;

    const initializeConversation = async () => {
      setIsTyping(true);
      try {
        const sessionResponse = await aiCoachService.getOrCreateSession(apiGoal, 'assessment');
        const session = sessionResponse.session;
        setSessionId(session.id);

        if (session.messages && session.messages.length > 0) {
          const restoredMessages: Message[] = session.messages.map((msg) => ({
            id: generateMessageId(),
            sender: msg.role === 'assistant' ? 'ai' : 'user',
            text: msg.content,
            timestamp: new Date(session.createdAt),
            status: 'read' as const,
          }));

          setMessages(restoredMessages);
          setCurrentPhase(session.conversationPhase);
          setExtractedInsights(session.extractedInsights || []);

          if (session.isComplete) {
            setConversationComplete(true);
          }
        } else {
          const response = await aiCoachService.startConversation(apiGoal, undefined, language, true);

          const aiMessage: Message = {
            id: generateMessageId(),
            sender: 'ai',
            text: response.message,
            timestamp: new Date(),
            status: 'read',
          };

          setMessages([aiMessage]);
          setCurrentPhase(response.phase);
        }

        setError(null);
      } catch (err) {
        console.error('Failed to start conversation:', err);
        setError('Failed to connect to AI Coach. Please try again.');
      } finally {
        setIsTyping(false);
        setTimeout(scrollToBottom, 100);
      }
    };

    initializeConversation();
  }, [apiGoal, aiAvailable, scrollToBottom, language]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessageText = inputValue.trim();
    setInputValue('');
    setError(null);

    const userMessage: Message = {
      id: generateMessageId(),
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    setTimeout(scrollToBottom, 100);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: 'sent' as const } : m))
      );
    }, 300);

    setIsTyping(true);

    try {
      const newUserCount = userMessageCount + 1;

      const response = await aiCoachService.chat(
        userMessageText,
        apiGoal,
        sessionId || undefined,
        true // isOnboarding - use lightweight assessment flow
      );

      if (response.sessionId && !sessionId) {
        setSessionId(response.sessionId);
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: 'read' as const } : m))
      );

      if (response.isComplete || newUserCount >= TARGET_USER_MESSAGES) {
        setConversationComplete(true);
        setExtractedInsights(response.insights);
        setIsTyping(false);

        const aiMessage: Message = {
          id: generateMessageId(),
          sender: 'ai',
          text: response.message,
          timestamp: new Date(),
          status: 'read',
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, TYPING_INDICATOR_MIN_DELAY));

        const aiMessage: Message = {
          id: generateMessageId(),
          sender: 'ai',
          text: response.message,
          timestamp: new Date(),
          status: 'read',
        };

        setMessages((prev) => [...prev, aiMessage]);
        setCurrentPhase(response.phase);
        setExtractedInsights(response.insights);
      }

      onAddAssessmentResponse({
        questionId: `deep_conversation_${newUserCount}`,
        value: userMessageText,
      });
    } catch (err) {
      console.error('Failed to send message:', err);

      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: 'error' as const } : m))
      );

      setError('Failed to get AI response. Please try again.');
    } finally {
      setIsTyping(false);
      setTimeout(scrollToBottom, 100);
    }
  }, [
    inputValue,
    isTyping,
    userMessageCount,
    apiGoal,
    sessionId,
    onAddAssessmentResponse,
    scrollToBottom,
  ]);

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.sender === 'user' && m.status === 'error');
    if (lastUserMessage) {
      setMessages((prev) => prev.filter((m) => m.id !== lastUserMessage.id));
      setInputValue(lastUserMessage.text);
      setError(null);
    }
  }, [messages]);

  const retryInit = useCallback(() => {
    hasInitializedRef.current = false;
    setError(null);
    setAiAvailable(null);
    aiCoachService.checkStatus().then((status) => {
      setAiAvailable(status.available);
    });
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      if (isUploading || isTyping) return;

      setIsUploading(true);
      setError(null);

      const imageUrl = URL.createObjectURL(file);

      const userMessage: Message = {
        id: generateMessageId(),
        sender: 'user',
        text: `Uploaded image: ${file.name}`,
        timestamp: new Date(),
        status: 'sending',
        imageUrl,
        imageName: file.name,
      };

      setMessages((prev) => [...prev, userMessage]);
      setTimeout(scrollToBottom, 100);

      try {
        const question = inputValue.trim() || undefined;
        const response = await aiCoachService.analyzeImage(file, apiGoal, question);

        if (question) {
          setInputValue('');
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === userMessage.id ? { ...m, status: 'read' as const } : m))
        );

        const aiMessage: Message = {
          id: generateMessageId(),
          sender: 'ai',
          text: response.response,
          timestamp: new Date(),
          status: 'read',
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (response.analysis.insights?.length) {
          setExtractedInsights((prev) => [...prev, ...response.analysis.insights]);
        }

        onAddAssessmentResponse({
          questionId: `image_analysis_${Date.now()}`,
          value: JSON.stringify({
            imageType: response.imageType,
            analysis: response.analysis.analysis,
            recommendations: response.analysis.recommendations,
          }),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to analyze image';

        const isValidationRejection =
          errorMessage.toLowerCase().includes('not related to health') ||
          errorMessage.toLowerCase().includes('not health-related') ||
          errorMessage.toLowerCase().includes('invalid health image') ||
          errorMessage.toLowerCase().includes('image not related');

        if (isValidationRejection) {
          setMessages((prev) =>
            prev.map((m) => (m.id === userMessage.id ? { ...m, status: 'read' as const } : m))
          );

          const aiMessage: Message = {
            id: generateMessageId(),
            sender: 'ai',
            text: `I noticed that image doesn't appear to be health or fitness related.\n\nI can only analyze images that are related to your health journey, such as:\n- **Body/physique photos** - Progress pictures, posture shots\n- **Food photos** - Meals, nutrition labels, recipes\n- **Fitness progress** - Workout logs, exercise form\n- **Medical documents** - Lab results, health reports (I'll recommend consulting a doctor)\n\nPlease try uploading a relevant health image, or feel free to continue our conversation!`,
            timestamp: new Date(),
            status: 'read',
          };
          setMessages((prev) => [...prev, aiMessage]);
        } else {
          console.error('Failed to analyze image:', err);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id
                ? { ...m, status: 'error' as const, text: `Failed to analyze: ${file.name}` }
                : m
            )
          );

          setError(errorMessage);
        }
      } finally {
        setIsUploading(false);
        setTimeout(scrollToBottom, 100);
      }
    },
    [isUploading, isTyping, inputValue, apiGoal, onAddAssessmentResponse, scrollToBottom]
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex <= 0) return;

      let userMessageIndex = messageIndex - 1;
      while (userMessageIndex >= 0 && messages[userMessageIndex].sender !== 'user') {
        userMessageIndex--;
      }
      if (userMessageIndex < 0) return;

      const userMessage = messages[userMessageIndex];

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setIsTyping(true);
      setError(null);

      try {
        const historyUpToUser = messages.slice(0, messageIndex);
        const history = messagesToChatHistory(historyUpToUser);

        const response = await aiCoachService.sendMessage(
          userMessage.text,
          apiGoal,
          history,
          userMessageCount,
          extractedInsights,
          language
        );

        await new Promise((resolve) => setTimeout(resolve, TYPING_INDICATOR_MIN_DELAY));

        const newAiMessage: Message = {
          id: generateMessageId(),
          sender: 'ai',
          text: response.message,
          timestamp: new Date(),
          status: 'read',
        };

        setMessages((prev) => [...prev, newAiMessage]);
        setCurrentPhase(response.phase);
        setExtractedInsights(response.insights);

        if (response.isComplete) {
          setConversationComplete(true);
        }
      } catch (err) {
        console.error('Failed to regenerate message:', err);
        setError('Failed to regenerate response. Please try again.');
      } finally {
        setIsTyping(false);
        setTimeout(scrollToBottom, 100);
      }
    },
    [messages, apiGoal, userMessageCount, extractedInsights, language, scrollToBottom]
  );

  const resetLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguage(lang);
    hasInitializedRef.current = false;
    setMessages([]);
  }, []);

  return {
    // State
    messages,
    inputValue,
    isTyping,
    isUploading,
    conversationComplete,
    currentPhase,
    extractedInsights,
    displayInsights,
    error,
    aiAvailable,
    language,
    sessionId,
    userMessageCount,

    // Actions
    setInputValue,
    setLanguage,
    sendMessage,
    retryLastMessage,
    retryInit,
    uploadImage,
    regenerateMessage,
    resetLanguage,

    // Refs
    messagesEndRef,
    chatContainerRef,
  };
}
