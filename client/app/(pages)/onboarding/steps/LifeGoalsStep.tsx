'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  SkipForward,
  Loader2,
  DollarSign,
  BookHeart,
  Users,
  GraduationCap,
  Briefcase,
  HeartPulse,
  Compass,
  MessageCircle,
  Zap,
  Smile,
  Shield,
  Palette,
  Sprout,
  Check,
  Sparkles,
  RefreshCw,
  Plus,
  PartyPopper,
  Send,
  ChevronRight,
  X,
  Pencil,
} from 'lucide-react';
import { useOnboarding } from '@/src/features/onboarding/context/OnboardingContext';
import { lifeGoalsService } from '@/src/shared/services/wellbeing.service';
import type { LifeGoalCategory } from '@shared/types/domain/wellbeing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubStep = 'conversation' | 'suggestions' | 'confirm';
type MotivationTier = 'low' | 'medium' | 'high';

interface Answer {
  question: string;
  answer: string;
}

interface SuggestedGoal {
  title: string;
  category: LifeGoalCategory;
  actions: string[];
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------

interface CategoryConfig {
  id: LifeGoalCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'financial', label: 'Financial', icon: DollarSign, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/50' },
  { id: 'faith', label: 'Faith', icon: BookHeart, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/50' },
  { id: 'relationships', label: 'Relationships', icon: Users, color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/50' },
  { id: 'education', label: 'Education', icon: GraduationCap, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/50' },
  { id: 'career', label: 'Career', icon: Briefcase, color: 'text-slate-400', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/50' },
  { id: 'health_wellness', label: 'Health & Wellness', icon: HeartPulse, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/50' },
  { id: 'spiritual', label: 'Spiritual', icon: Compass, color: 'text-teal-400', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500/50' },
  { id: 'social', label: 'Social', icon: MessageCircle, color: 'text-sky-400', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/50' },
  { id: 'productivity', label: 'Productivity', icon: Zap, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/50' },
  { id: 'happiness', label: 'Happiness', icon: Smile, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/50' },
  { id: 'anxiety_management', label: 'Anxiety Management', icon: Shield, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/50' },
  { id: 'creative', label: 'Creative', icon: Palette, color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/10', borderColor: 'border-fuchsia-500/50' },
  { id: 'personal_growth', label: 'Personal Growth', icon: Sprout, color: 'text-lime-400', bgColor: 'bg-lime-500/10', borderColor: 'border-lime-500/50' },
];

function getCategoryConfig(categoryId: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.id === categoryId);
}

// ---------------------------------------------------------------------------
// Motivation tier cards
// ---------------------------------------------------------------------------

const MOTIVATION_OPTIONS: Array<{
  tier: MotivationTier;
  emoji: string;
  label: string;
  description: string;
}> = [
  { tier: 'low', emoji: '\uD83C\uDF31', label: 'Low', description: 'I want to change but struggle to start' },
  { tier: 'medium', emoji: '\u26A1', label: 'Medium', description: 'I want to improve but need guidance' },
  { tier: 'high', emoji: '\uD83D\uDD25', label: 'High', description: "I'm ready to go all in" },
];

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

interface Question {
  id: string;
  text: string;
  type: 'text' | 'cards';
  optional?: boolean;
  placeholder?: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'improvement',
    text: "What's the #1 thing you want to improve in your life?",
    type: 'text',
    placeholder: 'e.g., Get fit, be more present, save money...',
  },
  {
    id: 'motivation',
    text: 'How motivated are you to make changes right now?',
    type: 'cards',
  },
  {
    id: 'past_attempts',
    text: "What have you tried before that didn't work?",
    type: 'text',
    optional: true,
    placeholder: 'e.g., Gym memberships, diets, meditation apps...',
  },
  {
    id: 'other_goals',
    text: 'Any other life goals? (e.g., save money, pray more, read books, reduce screen time)',
    type: 'text',
    optional: true,
    placeholder: 'Type anything you want to work on...',
  },
];

// ---------------------------------------------------------------------------
// Client-side fallback goal generation
// ---------------------------------------------------------------------------

function generateFallbackGoals(
  answers: Answer[],
  motivationTier: MotivationTier,
): SuggestedGoal[] {
  const mainAnswer = answers[0]?.answer?.toLowerCase() ?? '';
  const otherGoals = answers.find((a) => a.question.includes('other life goals'))?.answer ?? '';
  const goals: SuggestedGoal[] = [];

  // Keyword-based category detection for main answer
  const keywordMap: Array<{ keywords: string[]; category: LifeGoalCategory; title: string }> = [
    { keywords: ['fit', 'gym', 'exercise', 'workout', 'weight', 'muscle', 'run', 'health', 'body'], category: 'health_wellness', title: 'Get healthier and more active' },
    { keywords: ['money', 'save', 'invest', 'debt', 'financial', 'income', 'budget'], category: 'financial', title: 'Build better financial habits' },
    { keywords: ['read', 'learn', 'study', 'course', 'skill', 'education'], category: 'education', title: 'Commit to continuous learning' },
    { keywords: ['pray', 'faith', 'spiritual', 'god', 'church', 'mosque', 'meditat'], category: 'spiritual', title: 'Deepen spiritual practice' },
    { keywords: ['friend', 'family', 'relationship', 'social', 'connect', 'lonely'], category: 'relationships', title: 'Strengthen personal relationships' },
    { keywords: ['career', 'job', 'promotion', 'work', 'professional'], category: 'career', title: 'Advance career goals' },
    { keywords: ['happy', 'happiness', 'joy', 'fulfil', 'content', 'present'], category: 'happiness', title: 'Cultivate daily happiness' },
    { keywords: ['stress', 'anxiety', 'calm', 'peace', 'overwhelm', 'panic'], category: 'anxiety_management', title: 'Manage stress and anxiety' },
    { keywords: ['creat', 'art', 'music', 'writ', 'paint', 'design'], category: 'creative', title: 'Express creativity regularly' },
    { keywords: ['productive', 'focus', 'time', 'procrastinat', 'screen', 'habit'], category: 'productivity', title: 'Boost daily productivity' },
    { keywords: ['grow', 'improve', 'better', 'self', 'mindset', 'disciplin'], category: 'personal_growth', title: 'Invest in personal growth' },
  ];

  // Detect from main answer
  for (const entry of keywordMap) {
    if (entry.keywords.some((kw) => mainAnswer.includes(kw))) {
      goals.push({
        title: entry.title,
        category: entry.category,
        actions: generateActionsForCategory(entry.category, motivationTier),
        enabled: true,
      });
      break;
    }
  }

  // If no match, default to personal growth
  if (goals.length === 0) {
    goals.push({
      title: answers[0]?.answer?.trim() || 'Improve my life',
      category: 'personal_growth',
      actions: generateActionsForCategory('personal_growth', motivationTier),
      enabled: true,
    });
  }

  // Parse other goals
  if (otherGoals.trim()) {
    const parts = otherGoals.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts.slice(0, 2)) {
      const lowerPart = part.toLowerCase();
      let matched = false;
      for (const entry of keywordMap) {
        if (entry.keywords.some((kw) => lowerPart.includes(kw)) && !goals.some((g) => g.category === entry.category)) {
          goals.push({
            title: entry.title,
            category: entry.category,
            actions: generateActionsForCategory(entry.category, motivationTier),
            enabled: true,
          });
          matched = true;
          break;
        }
      }
      if (!matched && goals.length < 5) {
        goals.push({
          title: part.charAt(0).toUpperCase() + part.slice(1),
          category: 'personal_growth',
          actions: generateActionsForCategory('personal_growth', motivationTier),
          enabled: true,
        });
      }
    }
  }

  return goals.slice(0, 5);
}

function generateActionsForCategory(
  category: LifeGoalCategory,
  tier: MotivationTier,
): string[] {
  const actionMap: Record<string, Record<MotivationTier, string[]>> = {
    health_wellness: {
      low: ['Take a 10-minute walk daily', 'Drink 8 glasses of water', 'Stretch for 5 minutes each morning'],
      medium: ['Exercise 3 times per week', 'Meal prep on Sundays', 'Track daily step count'],
      high: ['Follow a structured workout plan', 'Hit macro targets daily', 'Train 5 days per week'],
    },
    financial: {
      low: ['Track all spending for 1 week', 'Set up auto-save for small amount', 'Review subscriptions'],
      medium: ['Create a monthly budget', 'Save 10% of income', 'Start an emergency fund'],
      high: ['Invest monthly', 'Eliminate all unnecessary debt', 'Build 6-month emergency fund'],
    },
    personal_growth: {
      low: ['Journal for 5 minutes daily', 'Read 10 pages before bed', 'Practice one new skill weekly'],
      medium: ['Read 2 books per month', 'Take an online course', 'Set weekly reflection goals'],
      high: ['Complete a certification program', 'Find a mentor', 'Build a daily growth routine'],
    },
    education: {
      low: ['Read one article daily', 'Watch educational content', 'Learn one new word daily'],
      medium: ['Enroll in an online course', 'Practice skills 30 min/day', 'Join a study group'],
      high: ['Pursue a formal credential', 'Build a portfolio project', 'Teach what you learn'],
    },
    spiritual: {
      low: ['Spend 5 minutes in quiet reflection', 'Read one spiritual passage daily', 'Practice gratitude'],
      medium: ['Establish a prayer routine', 'Attend weekly services', 'Join a spiritual community'],
      high: ['Daily dedicated spiritual practice', 'Volunteer through your community', 'Lead a small group'],
    },
    relationships: {
      low: ['Send one meaningful message daily', 'Call a friend weekly', 'Practice active listening'],
      medium: ['Schedule weekly quality time', 'Express gratitude to loved ones', 'Resolve one conflict'],
      high: ['Deepen 3 key relationships', 'Host monthly gatherings', 'Practice vulnerability daily'],
    },
    career: {
      low: ['Update your resume', 'Network with one person weekly', 'Learn one job-relevant skill'],
      medium: ['Set quarterly career goals', 'Seek a mentor', 'Build your professional brand'],
      high: ['Lead a significant project', 'Publish thought leadership', 'Negotiate a promotion'],
    },
    happiness: {
      low: ['Note 3 good things each day', 'Do one fun thing weekly', 'Spend time outdoors'],
      medium: ['Build a morning routine', 'Practice mindfulness', 'Reduce negative inputs'],
      high: ['Design your ideal day structure', 'Pursue a passion project', 'Practice daily meditation'],
    },
    anxiety_management: {
      low: ['Practice box breathing daily', 'Limit news consumption', 'Write worries in a journal'],
      medium: ['Learn CBT techniques', 'Establish a wind-down routine', 'Exercise regularly for stress relief'],
      high: ['Build a comprehensive stress toolkit', 'Practice daily meditation', 'Work with a counselor'],
    },
    creative: {
      low: ['Doodle for 10 minutes daily', 'Try one creative thing weekly', 'Visit inspiring spaces'],
      medium: ['Dedicate 30 min/day to creating', 'Join a creative community', 'Share your work monthly'],
      high: ['Complete a creative project monthly', 'Build a portfolio', 'Enter competitions'],
    },
    productivity: {
      low: ['Make a daily to-do list', 'Use a timer for focused work', 'Declutter one area weekly'],
      medium: ['Time-block your schedule', 'Review goals weekly', 'Eliminate 2 time-wasters'],
      high: ['Build a full productivity system', 'Batch similar tasks', 'Optimize energy management'],
    },
    social: {
      low: ['Attend one social event monthly', 'Start one conversation daily', 'Join an online community'],
      medium: ['Host a small gathering', 'Join a club or group', 'Practice public speaking'],
      high: ['Organize community events', 'Build a support network', 'Mentor someone'],
    },
  };

  return actionMap[category]?.[tier] ?? actionMap['personal_growth'][tier];
}

// ---------------------------------------------------------------------------
// Typing indicator component
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-sky-500"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500 ml-1">Balencia is typing...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LifeGoalsStep - Onboarding step with AI-powered conversation flow
 * that generates personalized life goal suggestions.
 *
 * Sub-steps: conversation -> suggestions -> confirm
 */
export function LifeGoalsStep() {
  const { nextStep } = useOnboarding();

  // Sub-step navigation
  const [subStep, setSubStep] = useState<SubStep>('conversation');

  // Conversation state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [motivationTier, setMotivationTier] = useState<MotivationTier | null>(null);
  const [isTyping, setIsTyping] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Suggestions state
  const [suggestedGoals, setSuggestedGoals] = useState<SuggestedGoal[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customGoalTitle, setCustomGoalTitle] = useState('');
  const [customGoalCategory, setCustomGoalCategory] = useState<LifeGoalCategory>('personal_growth');

  // Confirm state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial typing indicator
  useEffect(() => {
    const timer = setTimeout(() => setIsTyping(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Show typing indicator when moving to next question
  useEffect(() => {
    if (currentQuestionIndex > 0 && currentQuestionIndex < QUESTIONS.length) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 800);
      return () => clearTimeout(timer);
    }
  }, [currentQuestionIndex]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answers, isTyping, currentQuestionIndex]);

  const currentQuestion = QUESTIONS[currentQuestionIndex] as Question | undefined;
  const allQuestionsAnswered = currentQuestionIndex >= QUESTIONS.length;

  // -------------------------------------------------------------------------
  // Conversation handlers
  // -------------------------------------------------------------------------

  const submitTextAnswer = useCallback(() => {
    if (!currentQuestion || currentQuestion.type !== 'text') return;
    const trimmed = currentInput.trim();
    if (!trimmed && !currentQuestion.optional) return;

    setAnswers((prev) => [...prev, { question: currentQuestion.text, answer: trimmed || '(skipped)' }]);
    setCurrentInput('');
    setCurrentQuestionIndex((prev) => prev + 1);
  }, [currentInput, currentQuestion]);

  const skipQuestion = useCallback(() => {
    if (!currentQuestion?.optional) return;
    setAnswers((prev) => [...prev, { question: currentQuestion.text, answer: '(skipped)' }]);
    setCurrentInput('');
    setCurrentQuestionIndex((prev) => prev + 1);
  }, [currentQuestion]);

  const selectMotivation = useCallback(
    (tier: MotivationTier) => {
      if (!currentQuestion || currentQuestion.type !== 'cards') return;
      setMotivationTier(tier);
      const option = MOTIVATION_OPTIONS.find((o) => o.tier === tier);
      setAnswers((prev) => [
        ...prev,
        { question: currentQuestion.text, answer: `${option?.emoji} ${option?.label} - ${option?.description}` },
      ]);
      setCurrentQuestionIndex((prev) => prev + 1);
    },
    [currentQuestion],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitTextAnswer();
      }
    },
    [submitTextAnswer],
  );

  // -------------------------------------------------------------------------
  // Generate goals
  // -------------------------------------------------------------------------

  const generateGoals = useCallback(async () => {
    if (!motivationTier) return;

    setIsGenerating(true);
    setError(null);

    const filteredAnswers = answers.filter((a) => a.answer !== '(skipped)');

    try {
      const generated = await lifeGoalsService.generateGoalsFromAssessment(filteredAnswers, motivationTier);
      setSuggestedGoals(
        generated.map((g) => ({
          title: g.title,
          category: g.category as LifeGoalCategory,
          actions: g.actions,
          enabled: true,
        })),
      );
    } catch {
      // Fallback to client-side generation
      const fallback = generateFallbackGoals(filteredAnswers, motivationTier);
      setSuggestedGoals(fallback);
    } finally {
      setIsGenerating(false);
    }
  }, [answers, motivationTier]);

  const proceedToSuggestions = useCallback(() => {
    setSubStep('suggestions');
    generateGoals();
  }, [generateGoals]);

  // -------------------------------------------------------------------------
  // Suggestion handlers
  // -------------------------------------------------------------------------

  const toggleGoal = useCallback((index: number) => {
    setSuggestedGoals((prev) =>
      prev.map((g, i) => (i === index ? { ...g, enabled: !g.enabled } : g)),
    );
  }, []);

  const startEditingGoal = useCallback((index: number) => {
    setSuggestedGoals((prev) => {
      setEditingTitle(prev[index].title);
      return prev;
    });
    setEditingGoalIndex(index);
  }, []);

  const saveEditingGoal = useCallback(() => {
    if (editingGoalIndex === null) return;
    const trimmed = editingTitle.trim();
    if (!trimmed) return;

    setSuggestedGoals((prev) =>
      prev.map((g, i) => (i === editingGoalIndex ? { ...g, title: trimmed } : g)),
    );
    setEditingGoalIndex(null);
    setEditingTitle('');
  }, [editingGoalIndex, editingTitle]);

  const addCustomGoal = useCallback(() => {
    const trimmed = customGoalTitle.trim();
    if (!trimmed || !motivationTier) return;

    setSuggestedGoals((prev) => [
      ...prev,
      {
        title: trimmed,
        category: customGoalCategory,
        actions: generateActionsForCategory(customGoalCategory, motivationTier),
        enabled: true,
      },
    ]);
    setCustomGoalTitle('');
    setShowCustomForm(false);
  }, [customGoalTitle, customGoalCategory, motivationTier]);

  // -------------------------------------------------------------------------
  // Final submission
  // -------------------------------------------------------------------------

  const handleConfirm = useCallback(async () => {
    const selectedGoals = suggestedGoals.filter((g) => g.enabled);
    if (selectedGoals.length === 0) {
      nextStep();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create each goal
      await Promise.all(
        selectedGoals.map((goal) =>
          lifeGoalsService.createGoal({
            category: goal.category,
            title: goal.title,
          }),
        ),
      );

      // Set motivation profile
      if (motivationTier) {
        try {
          await lifeGoalsService.setMotivationProfile(motivationTier);
        } catch {
          // Non-critical - continue anyway
        }
      }

      nextStep();
    } catch (err) {
      console.error('Failed to create life goals:', err);
      setError('Something went wrong saving your goals. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [suggestedGoals, motivationTier, nextStep]);

  const handleSkip = useCallback(() => {
    nextStep();
  }, [nextStep]);

  // -------------------------------------------------------------------------
  // Render: Sub-step A - Conversation
  // -------------------------------------------------------------------------

  if (subStep === 'conversation') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col h-full min-h-[60vh]">
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/20"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            <Sparkles className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Let&apos;s discover your goals
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Answer a few quick questions and we&apos;ll create a personalized plan for you.
          </p>
        </motion.div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" role="log" aria-label="Conversation">
          {/* Rendered messages */}
          {answers.map((answer, i) => (
            <div key={`answer-${i}`}>
              {/* AI question bubble */}
              <motion.div
                className="flex gap-3 mb-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="w-8 h-8 rounded-full bg-sky-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-slate-200">{QUESTIONS[i].text}</p>
                </div>
              </motion.div>

              {/* User answer bubble */}
              <motion.div
                className="flex justify-end mb-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="bg-sky-600/20 border border-sky-600/30 rounded-2xl rounded-tr-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-white">{answer.answer}</p>
                </div>
              </motion.div>
            </div>
          ))}

          {/* Current question */}
          {!allQuestionsAnswered && (
            <>
              {isTyping ? (
                <motion.div
                  className="flex gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-8 h-8 rounded-full bg-sky-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl rounded-tl-md">
                    <TypingIndicator />
                  </div>
                </motion.div>
              ) : currentQuestion ? (
                <motion.div
                  className="flex gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-8 h-8 rounded-full bg-sky-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                    <p className="text-sm text-slate-200">{currentQuestion.text}</p>
                  </div>
                </motion.div>
              ) : null}
            </>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        {!isTyping && !allQuestionsAnswered && currentQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {currentQuestion.type === 'text' ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={currentQuestion.placeholder}
                    maxLength={200}
                    autoFocus
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition-colors"
                    aria-label={currentQuestion.text}
                  />
                  <button
                    type="button"
                    onClick={submitTextAnswer}
                    disabled={!currentInput.trim() && !currentQuestion.optional}
                    className="px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors flex items-center justify-center min-w-[48px]"
                    aria-label="Send answer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {currentQuestion.optional && (
                  <button
                    type="button"
                    onClick={skipQuestion}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip this question
                  </button>
                )}
              </div>
            ) : currentQuestion.type === 'cards' ? (
              <div className="grid grid-cols-3 gap-3">
                {MOTIVATION_OPTIONS.map((option) => (
                  <motion.button
                    key={option.tier}
                    type="button"
                    onClick={() => selectMotivation(option.tier)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#02000f] border border-white/24 hover:border-emerald-600/50 hover:bg-emerald-600/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-label={`${option.label} motivation: ${option.description}`}
                  >
                    <span className="text-2xl" role="img" aria-hidden="true">{option.emoji}</span>
                    <span className="text-sm font-medium text-white">{option.label}</span>
                    <span className="text-xs text-slate-400 text-center leading-tight">{option.description}</span>
                  </motion.button>
                ))}
              </div>
            ) : null}
          </motion.div>
        )}

        {/* Continue button after all questions */}
        {allQuestionsAnswered && !isTyping && (
          <motion.div
            className="space-y-3 mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              type="button"
              onClick={proceedToSuggestions}
              className="w-full py-4 rounded-xl font-semibold text-base bg-sky-600 text-white border border-white/20 hover:shadow-lg hover:shadow-sky-600/20 transition-all flex items-center justify-center gap-3"
            >
              Generate My Goals
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* Skip always available */}
        <button
          type="button"
          onClick={handleSkip}
          className="mt-3 w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <SkipForward className="w-4 h-4" />
          Skip for now
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Sub-step B - AI Suggestions
  // -------------------------------------------------------------------------

  if (subStep === 'suggestions') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/20"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
          >
            <Sparkles className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Your personalized goals
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Toggle on the goals you want to pursue. Edit titles to make them yours.
          </p>
        </motion.div>

        {/* Loading state */}
        {isGenerating ? (
          <motion.div
            className="flex flex-col items-center justify-center py-16 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-8 h-8 text-sky-500" />
            </motion.div>
            <p className="text-slate-300 text-sm font-medium">Generating your personalized goals...</p>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-sky-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Regenerate button */}
            <motion.div
              className="flex justify-end mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                type="button"
                onClick={generateGoals}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-sky-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-sky-500/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </motion.div>

            {/* Goal cards */}
            <div className="space-y-3 mb-6">
              <AnimatePresence mode="popLayout">
                {suggestedGoals.map((goal, index) => {
                  const catConfig = getCategoryConfig(goal.category);
                  const Icon = catConfig?.icon ?? Sprout;

                  return (
                    <motion.div
                      key={`goal-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.08 }}
                      className={`p-4 rounded-xl border transition-all ${
                        goal.enabled
                          ? `${catConfig?.bgColor ?? 'bg-emerald-500/10'} ${catConfig?.borderColor ?? 'border-emerald-500/50'}`
                          : 'bg-slate-900/30 border-slate-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Icon + content */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              goal.enabled
                                ? catConfig?.bgColor ?? 'bg-emerald-500/10'
                                : 'bg-slate-800'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 ${
                                goal.enabled ? catConfig?.color ?? 'text-emerald-400' : 'text-slate-500'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Title - editable */}
                            {editingGoalIndex === index ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditingGoal();
                                    if (e.key === 'Escape') setEditingGoalIndex(null);
                                  }}
                                  maxLength={100}
                                  autoFocus
                                  className="flex-1 px-2 py-1 rounded-md bg-slate-900/60 border border-slate-600 text-white text-sm focus:outline-none focus:border-emerald-600"
                                  aria-label="Edit goal title"
                                />
                                <button
                                  type="button"
                                  onClick={saveEditingGoal}
                                  className="p-1 text-emerald-400 hover:text-emerald-300"
                                  aria-label="Save title"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingGoalIndex(null)}
                                  className="p-1 text-slate-400 hover:text-slate-300"
                                  aria-label="Cancel editing"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingGoal(index)}
                                className="flex items-center gap-1.5 group text-left"
                                aria-label={`Edit goal: ${goal.title}`}
                              >
                                <span className="text-sm font-medium text-white truncate">
                                  {goal.title}
                                </span>
                                <Pencil className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                              </button>
                            )}

                            {/* Category badge */}
                            <span className={`text-xs ${catConfig?.color ?? 'text-slate-400'} mt-0.5 inline-block`}>
                              {catConfig?.label ?? goal.category}
                            </span>

                            {/* Preview actions */}
                            {goal.actions.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {goal.actions.slice(0, 3).map((action, ai) => (
                                  <p key={ai} className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                                    {action}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleGoal(index)}
                          role="switch"
                          aria-checked={goal.enabled}
                          aria-label={`${goal.enabled ? 'Disable' : 'Enable'} goal: ${goal.title}`}
                          className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors mt-1 ${
                            goal.enabled ? 'bg-emerald-600' : 'bg-slate-700'
                          }`}
                        >
                          <motion.div
                            className="w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5"
                            animate={{ left: goal.enabled ? '22px' : '2px' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Add custom goal */}
            {showCustomForm ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 rounded-xl border border-slate-700 bg-slate-900/50 space-y-3"
              >
                <input
                  type="text"
                  value={customGoalTitle}
                  onChange={(e) => setCustomGoalTitle(e.target.value)}
                  placeholder="Goal title..."
                  maxLength={100}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition-colors"
                  aria-label="Custom goal title"
                />
                <select
                  value={customGoalCategory}
                  onChange={(e) => setCustomGoalCategory(e.target.value as LifeGoalCategory)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition-colors"
                  aria-label="Goal category"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addCustomGoal}
                    disabled={!customGoalTitle.trim()}
                    className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-colors"
                  >
                    Add Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCustomForm(false); setCustomGoalTitle(''); }}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-300 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                type="button"
                onClick={() => setShowCustomForm(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="w-full mb-6 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Goal
              </motion.button>
            )}

            {/* Continue */}
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <button
                type="button"
                onClick={() => setSubStep('confirm')}
                disabled={!suggestedGoals.some((g) => g.enabled)}
                className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-3 ${
                  suggestedGoals.some((g) => g.enabled)
                    ? 'bg-sky-600 text-white border border-white/20 hover:shadow-lg hover:shadow-sky-600/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                Skip for now
              </button>
            </motion.div>
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Sub-step C - Confirm & Create
  // -------------------------------------------------------------------------

  const selectedGoals = suggestedGoals.filter((g) => g.enabled);
  const motivationOption = MOTIVATION_OPTIONS.find((o) => o.tier === motivationTier);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header with celebration */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
        >
          <PartyPopper className="w-7 h-7 text-white" />
        </motion.div>
        <motion.h1
          className="text-2xl sm:text-3xl font-bold text-white mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Your plan is ready!
        </motion.h1>
        <motion.p
          className="text-slate-400 text-sm max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} ready to track. Your AI coach will help you stay on course.
        </motion.p>
      </motion.div>

      {/* Motivation badge */}
      {motivationOption && (
        <motion.div
          className="flex justify-center mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span role="img" aria-hidden="true">{motivationOption.emoji}</span>
            <span className="text-sm text-emerald-300 font-medium">
              {motivationOption.label} Motivation
            </span>
          </div>
        </motion.div>
      )}

      {/* Selected goals summary */}
      <motion.div
        className="space-y-3 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {selectedGoals.map((goal, index) => {
          const catConfig = getCategoryConfig(goal.category);
          const Icon = catConfig?.icon ?? Sprout;

          return (
            <motion.div
              key={`confirm-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${catConfig?.bgColor ?? 'bg-emerald-500/10'} border ${catConfig?.borderColor ?? 'border-emerald-500/50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${catConfig?.bgColor ?? 'bg-emerald-500/10'}`}>
                <Icon className={`w-4 h-4 ${catConfig?.color ?? 'text-emerald-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{goal.title}</p>
                <p className={`text-xs ${catConfig?.color ?? 'text-slate-400'}`}>{catConfig?.label ?? goal.category}</p>
              </div>
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-red-400 text-xs mb-4"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Actions */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl font-semibold text-base bg-sky-600 text-white border border-white/20 hover:shadow-lg hover:shadow-sky-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating your goals...
            </>
          ) : (
            <>
              Start Your Journey
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          disabled={isSubmitting}
          className="w-full py-3 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <SkipForward className="w-4 h-4" />
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
