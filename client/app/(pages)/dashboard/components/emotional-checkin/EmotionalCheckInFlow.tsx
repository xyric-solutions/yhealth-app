"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Sparkles,
  Camera,
  Brain,
  Zap,
  Shield,
  Bot,
  User,
} from "lucide-react";
import {
  emotionalCheckInService,
  type EmotionalCheckInSession,
} from "@/src/shared/services/emotional-checkin.service";
import { CheckInQuestion } from "./CheckInQuestion";
import { CheckInResults } from "./CheckInResults";
import { CrisisResourcesModal } from "./CrisisResourcesModal";
import { TensorFlowEmotionAnalyzer } from "./TensorFlowEmotionAnalyzer";
import toast from "react-hot-toast";

/* ───────── Types ───────── */

interface Insight {
  category: string;
  description: string;
  severity: "mild" | "moderate" | "significant";
  trend?: "improving" | "stable" | "declining";
}

interface CheckInInsights {
  summary: string;
  details: Insight[];
  patterns?: Record<string, unknown>;
}

interface CheckInSession {
  id: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  questionCount: number;
  screeningType: string;
  overallAnxietyScore?: number;
  overallMoodScore?: number;
  riskLevel: string;
  crisisDetected: boolean;
  insights: CheckInInsights;
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    duration?: number;
  }>;
}

interface Question {
  id: string;
  question: string;
  type: "scale" | "frequency" | "text";
  options?: string[];
  scaleRange?: { min: number; max: number; labels?: string[] };
}

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
}

/* ───────── Helpers ───────── */

function convertSession(
  serviceSession: EmotionalCheckInSession
): CheckInSession {
  let insights: CheckInInsights;

  if (
    serviceSession.insights &&
    typeof serviceSession.insights === "object"
  ) {
    if (
      "summary" in serviceSession.insights &&
      "details" in serviceSession.insights
    ) {
      insights = serviceSession.insights as unknown as CheckInInsights;
    } else {
      const r = serviceSession.insights as Record<string, unknown>;
      insights = {
        summary:
          typeof r.summary === "string"
            ? r.summary
            : "Your check-in is complete.",
        details: Array.isArray(r.details) ? (r.details as Insight[]) : [],
        patterns: r.patterns as Record<string, unknown> | undefined,
      };
    }
  } else {
    insights = { summary: "Your check-in is complete.", details: [] };
  }

  return {
    id: serviceSession.id,
    userId: serviceSession.userId,
    startedAt: serviceSession.startedAt,
    completedAt: serviceSession.completedAt,
    questionCount: serviceSession.questionCount,
    screeningType: serviceSession.screeningType,
    overallAnxietyScore: serviceSession.overallAnxietyScore,
    overallMoodScore: serviceSession.overallMoodScore,
    riskLevel: serviceSession.riskLevel,
    crisisDetected: serviceSession.crisisDetected,
    insights,
    recommendations: serviceSession.recommendations,
  };
}

/* ───────── Typing Indicator ───────── */

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-end gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-500/15 shrink-0">
          <Bot className="h-3.5 w-3.5 text-pink-400" />
        </div>
        <div className="rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-pink-400/60"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Step Progress ───────── */

function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.min((current / total) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] font-medium text-slate-500 tabular-nums whitespace-nowrap">
        {current} / {total}
      </span>
    </div>
  );
}

/* ───────── Chat Bubble ───────── */

function ChatBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex items-end gap-2.5 max-w-[85%] ${
          isUser ? "flex-row-reverse" : ""
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
            isUser ? "bg-violet-500/15" : "bg-pink-500/15"
          }`}
        >
          {isUser ? (
            <User className="h-3.5 w-3.5 text-violet-400" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-pink-400" />
          )}
        </div>

        {/* Bubble */}
        <div
          className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "rounded-2xl rounded-br-md bg-violet-500/15 text-violet-100 border border-violet-500/20"
              : "rounded-2xl rounded-bl-md bg-white/[0.04] text-slate-200 border border-white/[0.06]"
          }`}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

/* ───────── AI Camera Card ───────── */

function AICameraCard({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.06] to-pink-500/[0.04] p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 shrink-0">
          <Brain className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white">
              AI Emotion Analysis
            </h4>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-pink-500/20 text-pink-400 border border-pink-500/20">
              Beta
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Real-time facial expression analysis — processed entirely on your
            device.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { icon: Zap, label: "~20s", color: "text-amber-400" },
              { icon: Camera, label: "On-device", color: "text-blue-400" },
              { icon: Shield, label: "Private", color: "text-emerald-400" },
            ].map(({ icon: Icon, label, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-slate-400"
              >
                <Icon className={`h-2.5 w-2.5 ${color}`} />
                {label}
              </span>
            ))}
          </div>

          <motion.button
            onClick={onStart}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-400 hover:to-pink-400 text-white text-xs font-semibold transition-all shadow-lg shadow-violet-500/15"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Start AI Analysis
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════ Main Component ═══════════ */

export function EmotionalCheckInFlow() {
  const [session, setSession] = useState<CheckInSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
    null
  );
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, isLoading]);

  /* Start on mount */
  useEffect(() => {
    startCheckIn();
  }, []);

  const startCheckIn = async () => {
    try {
      setIsStarting(true);
      const result = await emotionalCheckInService.startCheckIn("standard");
      setSession(convertSession(result.session));

      const greeting: ConversationMessage = {
        role: "assistant",
        content: result.greeting,
        timestamp: new Date(),
      };
      setConversationHistory([greeting]);
      setCurrentQuestion(result.firstQuestion);

      const questionMessage: ConversationMessage = {
        role: "assistant",
        content: result.firstQuestion.question,
        timestamp: new Date(),
      };
      setConversationHistory((prev) => [...prev, questionMessage]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to start check-in";
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleResponse = async (value: number | string, text?: string) => {
    if (!session || !currentQuestion) return;

    try {
      setIsLoading(true);

      const userMessage: ConversationMessage = {
        role: "user",
        content: typeof value === "string" ? value : String(value),
        timestamp: new Date(),
      };
      setConversationHistory((prev) => [...prev, userMessage]);

      const result = await emotionalCheckInService.submitResponse(
        session.id,
        currentQuestion.id,
        value,
        text,
        conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        }))
      );

      if (result.isComplete) {
        await completeSession(session.id);
      } else if (result.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: result.nextQuestion.question,
          timestamp: new Date(),
        };
        setConversationHistory((prev) => [...prev, assistantMessage]);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit response";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const completeSession = async (sessionId: string) => {
    try {
      const completedSession =
        await emotionalCheckInService.completeSession(sessionId);
      setSession(convertSession(completedSession));
      setIsComplete(true);
      if (completedSession.crisisDetected) {
        setShowCrisisModal(true);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to complete check-in";
      toast.error(message);
    }
  };

  /* ── Loading State ── */
  if (isStarting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Heart className="h-8 w-8 text-pink-400" />
        </motion.div>
        <div className="text-center">
          <p className="text-sm font-medium text-white mb-1">
            Preparing your check-in
          </p>
          <p className="text-xs text-slate-500">
            Setting up a personalized experience...
          </p>
        </div>
      </div>
    );
  }

  /* ── Results State ── */
  if (isComplete && session) {
    return (
      <>
        <CheckInResults session={session} />
        {showCrisisModal && (
          <CrisisResourcesModal
            open={showCrisisModal}
            onOpenChange={setShowCrisisModal}
          />
        )}
      </>
    );
  }

  /* ── Conversation State ── */
  return (
    <div className="space-y-4">
      {/* Progress */}
      {session && (
        <StepProgress current={session.questionCount + 1} total={10} />
      )}

      {/* Chat Messages */}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/[0.06] scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {conversationHistory.map((message, index) => (
            <ChatBubble key={index} message={message} />
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Current Question Input */}
      {currentQuestion && !isLoading && (
        <div className="space-y-3 pt-2 border-t border-white/[0.04]">
          <CheckInQuestion
            question={currentQuestion}
            onRespond={handleResponse}
          />

          {/* AI Camera Card */}
          <AICameraCard onStart={() => setShowCamera(true)} />
        </div>
      )}

      {/* TensorFlow Modal */}
      {showCamera && session && (
        <TensorFlowEmotionAnalyzer
          sessionId={session.id}
          onAnalysisComplete={async (analysis) => {
            try {
              const result =
                await emotionalCheckInService.submitTensorFlowAnalysis(
                  session.id,
                  {
                    dominant: analysis.dominant,
                    distribution: analysis.distribution,
                    engagement: analysis.engagement,
                    stressIndicators: analysis.stressIndicators,
                    averageConfidence: analysis.averageConfidence,
                    sampleCount: analysis.sampleCount,
                  }
                );

              if (result.insights && result.insights.length > 0) {
                toast.success(result.insights[0], { duration: 5000 });
              } else {
                toast.success(
                  "AI analysis complete! Emotional profile captured."
                );
              }

              const analysisMessage: ConversationMessage = {
                role: "assistant",
                content: `I've analyzed your facial expressions. Your dominant emotion appears to be ${analysis.dominant} with ${Math.round(analysis.engagement * 100)}% engagement. This will help me provide more personalized insights.`,
                timestamp: new Date(),
              };
              setConversationHistory((prev) => [
                ...prev,
                analysisMessage,
              ]);
              setShowCamera(false);
            } catch (error: unknown) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to process analysis";
              toast.error(message);
              setShowCamera(false);
            }
          }}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
