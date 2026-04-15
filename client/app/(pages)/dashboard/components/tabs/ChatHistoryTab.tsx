"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Brain,
  Download,
  Trash2,
  ChevronRight,
  Clock,
  Target,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  Sparkles,
  X,
  Eye,
} from "lucide-react";
import {
  aiCoachService,
  type AICoachSession,
} from "@/src/shared/services";
import { format, isToday, isYesterday } from "date-fns";

// Goal category display config
const GOAL_CONFIG: Record<string, { label: string; color: string; gradient: string }> = {
  weight_loss: { label: "Weight Loss", color: "text-orange-400", gradient: "from-orange-500 to-red-500" },
  muscle_building: { label: "Muscle Building", color: "text-blue-400", gradient: "from-blue-500 to-cyan-500" },
  sleep_improvement: { label: "Sleep Improvement", color: "text-indigo-400", gradient: "from-indigo-500 to-purple-500" },
  stress_wellness: { label: "Stress & Wellness", color: "text-emerald-400", gradient: "from-emerald-500 to-teal-500" },
  energy_productivity: { label: "Energy & Productivity", color: "text-amber-400", gradient: "from-amber-500 to-yellow-500" },
  event_training: { label: "Event Training", color: "text-rose-400", gradient: "from-rose-500 to-pink-500" },
  health_condition: { label: "Health Condition", color: "text-red-400", gradient: "from-red-500 to-rose-500" },
  habit_building: { label: "Habit Building", color: "text-green-400", gradient: "from-green-500 to-emerald-500" },
  overall_optimization: { label: "Overall Optimization", color: "text-violet-400", gradient: "from-violet-500 to-purple-500" },
  custom: { label: "Custom Goal", color: "text-slate-400", gradient: "from-slate-500 to-slate-600" },
};

function formatSmartDate(date: Date): string {
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

interface SessionCardProps {
  session: AICoachSession;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function SessionCard({ session, onView, onDownload, onDelete, isDeleting }: SessionCardProps) {
  const goalConfig = GOAL_CONFIG[session.goalCategory] || GOAL_CONFIG.custom;
  const sessionDate = new Date(session.createdAt);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-violet-500/30 hover:bg-slate-800/80 transition-all duration-300"
    >
      {/* Status indicator */}
      <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        session.isComplete
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-amber-500/20 text-amber-400"
      }`}>
        {session.isComplete ? (
          <>
            <CheckCircle className="w-3 h-3" />
            Completed
          </>
        ) : (
          <>
            <Clock className="w-3 h-3" />
            In Progress
          </>
        )}
      </div>

      {/* Goal badge */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${goalConfig.gradient} flex items-center justify-center shadow-lg`}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{goalConfig.label}</h3>
          <p className="text-xs text-slate-500">{session.sessionType || "Assessment"}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <MessageSquare className="w-4 h-4" />
          <span>{session.messageCount} messages</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Calendar className="w-4 h-4" />
          <span>{formatSmartDate(sessionDate)}</span>
        </div>
      </div>

      {/* Summary preview */}
      {session.sessionSummary && (
        <p className="text-sm text-slate-400 line-clamp-2 mb-4">
          {session.sessionSummary}
        </p>
      )}

      {/* Insights preview */}
      {session.extractedInsights && session.extractedInsights.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {session.extractedInsights.slice(0, 3).map((insight, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs capitalize"
            >
              {insight.category.replace(/_/g, " ")}
            </span>
          ))}
          {session.extractedInsights.length > 3 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 text-xs">
              +{session.extractedInsights.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50">
        <motion.button
          onClick={onView}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors text-sm font-medium"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Eye className="w-4 h-4" />
          View
        </motion.button>
        <motion.button
          onClick={onDownload}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm font-medium"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Download className="w-4 h-4" />
          Download
        </motion.button>
        <motion.button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Delete
        </motion.button>
      </div>
    </motion.div>
  );
}

interface SessionViewModalProps {
  session: AICoachSession;
  onClose: () => void;
  onDownload: () => void;
}

function SessionViewModal({ session, onClose, onDownload }: SessionViewModalProps) {
  const goalConfig = GOAL_CONFIG[session.goalCategory] || GOAL_CONFIG.custom;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${goalConfig.gradient} flex items-center justify-center`}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">{goalConfig.label}</h2>
              <p className="text-xs text-slate-400">
                {format(new Date(session.createdAt), "MMMM d, yyyy")} • {session.messageCount} messages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download className="w-4 h-4" />
              Download
            </motion.button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(85vh - 120px)" }}>
          {session.messages.map((msg, idx) => {
            const isAI = msg.role === "assistant";
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex ${isAI ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    isAI
                      ? "bg-slate-800 border border-slate-700/50 rounded-bl-sm"
                      : "bg-gradient-to-br from-violet-600 to-purple-600 rounded-br-sm"
                  }`}
                >
                  <p className={`text-sm leading-relaxed ${isAI ? "text-slate-200" : "text-white"}`}>
                    {msg.content}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* Insights Section */}
          {session.extractedInsights && session.extractedInsights.length > 0 && (
            <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-400 mb-3">
                <Sparkles className="w-4 h-4" />
                Key Insights
              </h3>
              <div className="space-y-2">
                {session.extractedInsights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs capitalize shrink-0">
                      {insight.category.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-slate-300">{insight.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {session.sessionSummary && (
            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-400 mb-2">
                <FileText className="w-4 h-4" />
                Summary
              </h3>
              <p className="text-sm text-slate-300">{session.sessionSummary}</p>
            </div>
          )}

          {/* Key Takeaways */}
          {session.keyTakeaways && session.keyTakeaways.length > 0 && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-2">
                <Target className="w-4 h-4" />
                Key Takeaways
              </h3>
              <ul className="space-y-1">
                {session.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                    <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ChatHistoryTab() {
  const [sessions, setSessions] = useState<AICoachSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<AICoachSession | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await aiCoachService.getChatHistory(50);
      setSessions(response.sessions);
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
      setError("Failed to load chat history. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDownload = async (sessionId: string) => {
    try {
      const blob = await aiCoachService.downloadSessionPDF(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-coach-session-${sessionId.slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download session:", err);
    }
  };

  const handleDelete = async (sessionId: string) => {
    const { confirm: confirmAction } = await import("@/components/common/ConfirmDialog");
    const confirmed = await confirmAction({
      title: "Delete Chat Session",
      description: "Are you sure you want to delete this chat session? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(sessionId);
    try {
      await aiCoachService.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-4" />
        <p className="text-slate-400">Loading chat history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load</h3>
        <p className="text-slate-400 mb-4">{error}</p>
        <motion.button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </motion.button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-6">
          <MessageSquare className="w-10 h-10 text-violet-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Chat History Yet</h3>
        <p className="text-slate-400 text-center max-w-md mb-6">
          Start a conversation with the AI Coach during onboarding or from the deep assessment to see your chat history here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Chat History</h2>
          <p className="text-slate-400 text-sm">View and download your AI Coach conversations</p>
        </div>
        <motion.button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <MessageSquare className="w-4 h-4" />
            Total Sessions
          </div>
          <div className="text-2xl font-bold text-white">{sessions.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Completed
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {sessions.filter((s) => s.isComplete).length}
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Clock className="w-4 h-4" />
            In Progress
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {sessions.filter((s) => !s.isComplete).length}
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Sparkles className="w-4 h-4" />
            Total Insights
          </div>
          <div className="text-2xl font-bold text-violet-400">
            {sessions.reduce((acc, s) => acc + (s.extractedInsights?.length || 0), 0)}
          </div>
        </div>
      </div>

      {/* Session Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onView={() => setViewingSession(session)}
              onDownload={() => handleDownload(session.id)}
              onDelete={() => handleDelete(session.id)}
              isDeleting={deletingId === session.id}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* View Modal */}
      <AnimatePresence>
        {viewingSession && (
          <SessionViewModal
            session={viewingSession}
            onClose={() => setViewingSession(null)}
            onDownload={() => handleDownload(viewingSession.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
