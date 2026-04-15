"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  Archive,
  MoreVertical,
  Sparkles,
  User,
  Mic,
  Menu,
  X,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ragChatService, RAGConversation, RAGChatMessage, ActionCommand } from "@/src/shared/services/rag-chat.service";
import { parseActionsFromResponse, executeActions, ActionExecutionResult } from "@/src/shared/services/action-handler.service";
import { api } from "@/lib/api-client";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { ImageAnalysisModal } from "../modals/ImageAnalysisModal";
import { RoutingChip } from "@/components/ai-coach/RoutingChip";
import type { RoutingChip as RoutingChipData } from "@/app/(pages)/life-areas/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  routingChip?: RoutingChipData | null;
}

export function AICoachTab() {
  const router = useRouter();

  // State
  const [conversations, setConversations] = useState<RAGConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const [actionResults, setActionResults] = useState<Map<string, ActionExecutionResult>>(new Map());
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalMode, setImageModalMode] = useState<"camera" | "upload">("upload");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth >= 1024) {
        // Desktop: show sidebar by default
        setShowSidebar(true);
      } else {
        // Mobile/Tablet: hide sidebar by default
        setShowSidebar(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Auto-load last conversation when conversations are loaded
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId && messages.length === 0 && !isLoading) {
      const lastConversation = conversations[0]; // Most recent conversation
      loadConversation(lastConversation.id);
    }
  }, [conversations, activeConversationId, messages.length, isLoading]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [inputMessage]);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const result = await ragChatService.getConversations({ limit: 50 });
      setConversations(result.conversations || []);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    setIsLoading(true);
    try {
      const result = await ragChatService.getConversation(conversationId, 100);
      setActiveConversationId(conversationId);
      setMessages(
        (result.messages || [])
          .filter((msg: RAGChatMessage) => (msg.role as string) !== 'system')
          .map((msg: RAGChatMessage) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.createdAt),
          }))
      );
      // Close sidebar on mobile/tablet when conversation is loaded
      if (window.innerWidth < 1024) {
        setShowSidebar(false);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    // Close sidebar on mobile/tablet when starting new conversation
    if (window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsSending(true);

    try {
      const response = await ragChatService.sendMessage({
        message: userMessage.content,
        conversationId: activeConversationId || undefined,
      });

      // Update conversation ID if this was a new conversation
      if (!activeConversationId && response.conversationId) {
        setActiveConversationId(response.conversationId);
        fetchConversations(); // Refresh conversation list
      }

      const assistantMessage: Message = {
        id: response.messageId || `resp-${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        routingChip: (response as { routingChip?: RoutingChipData | null }).routingChip ?? null,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Dispatch refresh events based on tool calls from AI
      if (response.toolCalls?.length) {
        const journalTools = ['createJournalEntry', 'updateJournalEntry', 'deleteJournalEntry'];
        const checkinTools = ['createDailyCheckin'];
        if (response.toolCalls.some(tc => journalTools.includes(tc.tool))) {
          window.dispatchEvent(new Event('journal-logged'));
        }
        if (response.toolCalls.some(tc => checkinTools.includes(tc.tool))) {
          window.dispatchEvent(new Event('checkin-completed'));
        }
      }

      // Parse and execute actions from response — filter out navigate actions
      // that would redirect the user away from the chat page
      const rawActions = response.actions || parseActionsFromResponse(response.message);
      if (rawActions && rawActions.length > 0) {
        // Filter out navigate actions (user is already in chat, don't redirect them)
        const safeActions = rawActions.filter(a => a.type !== 'navigate');
        if (safeActions.length > 0) {
          setTimeout(() => {
            executeActionsAsync(safeActions);
          }, 500);
        }
      }
    } catch (error) {
      // Check if it's a network error
      const isNetworkError = error && typeof error === 'object' && 'code' in error && error.code === 'NETWORK_ERROR';
      
      // Only log non-network errors to console (network errors are already handled in API client)
      if (!isNetworkError) {
        console.error("Failed to send message:", error);
      }
      
      // Add user-friendly error message
      const errorMessage = isNetworkError 
        ? "Unable to connect to the server. Please ensure the server is running and try again."
        : "I'm sorry, I encountered an error. Please try again.";
      
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Action execution handlers
  const handleNavigate = useCallback((tabId: string) => {
    // Navigate using router
    if (tabId === 'ai-coach') {
      router.push('/ai-coach');
    } else if (tabId === 'activity-status') {
      router.push('/activity-status');
    } else if (tabId.startsWith('wellbeing/') || tabId === 'wellbeing') {
      router.push(`/${tabId}`);
    } else {
      router.push(`/dashboard?tab=${tabId}`);
    }
  }, [router]);

  const handleUpdate = useCallback(async (target: string, params?: Record<string, unknown>): Promise<boolean> => {
    try {
      if (target === 'workout_plan' || target === 'workout plan') {
        const planId = params?.planId;
        if (!planId) {
          // Get active workout plan first
          const plansResponse = await api.get<{ plans?: Array<{ id: string; status?: string }> }>('/workouts/plans');
          const activePlan = plansResponse.data?.plans?.find((p) => p.status === 'active');
          if (!activePlan) {
            toast.error('No active workout plan found');
            return false;
          }
          // Use the active plan ID to update
          const updateParams = { ...params };
          delete updateParams.planId;
          const response = await api.patch(`/workouts/plans/${activePlan.id}`, updateParams);
          if (response.success) {
            toast.success('Workout plan updated successfully');
            return true;
          }
        } else {
          const updateParams = { ...params };
          delete updateParams.planId;
          const response = await api.patch(`/workouts/plans/${planId}`, updateParams);
          if (response.success) {
            toast.success('Workout plan updated successfully');
            return true;
          }
        }
      } else if (target === 'diet_plan' || target === 'diet plan' || target === 'nutrition plan') {
        const planId = params?.planId;
        if (!planId) {
          // Get active diet plan first
          const plansResponse = await api.get<{ plans?: Array<{ id: string }> }>('/diet-plans?status=active');
          const activePlan = plansResponse.data?.plans?.[0];
          if (!activePlan) {
            toast.error('No active diet plan found');
            return false;
          }
          const updateParams = { ...params };
          delete updateParams.planId;
          const response = await api.patch(`/diet-plans/${activePlan.id}`, updateParams);
          if (response.success) {
            toast.success('Diet plan updated successfully');
            return true;
          }
        } else {
          const updateParams = { ...params };
          delete updateParams.planId;
          const response = await api.patch(`/diet-plans/${planId}`, updateParams);
          if (response.success) {
            toast.success('Diet plan updated successfully');
            return true;
          }
        }
      } else if (target === 'goal') {
        const goalId = params?.goalId;
        if (!goalId) {
          toast.error('Goal ID required for update');
          return false;
        }
        const updateParams = { ...params };
        delete updateParams.goalId;
        const response = await api.patch(`/goals/${goalId}`, updateParams);
        if (response.success) {
          toast.success('Goal updated successfully');
          return true;
        }
      } else if (target === 'journal_entry' || target === 'journal') {
        const entryId = (params?.entryId || params?.id) as string;
        if (!entryId) { toast.error('Entry ID required'); return false; }
        const updateParams = { ...params };
        delete updateParams.entryId;
        delete updateParams.id;
        const response = await api.put(`/v1/wellbeing/journal/${entryId}`, updateParams);
        if (response.success) {
          window.dispatchEvent(new Event('journal-logged'));
          toast.success('Journal entry updated');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error('Failed to update. Please try again.');
      return false;
    }
  }, []);

  const handleCreate = useCallback(async (target: string, params?: Record<string, unknown>): Promise<boolean> => {
    try {
      if (target === 'workout_plan' || target === 'workout plan') {
        const response = await api.post('/workouts/plans', params || {});
        if (response.success) {
          toast.success('Workout plan created successfully');
          return true;
        }
      } else if (target === 'diet_plan' || target === 'diet plan' || target === 'nutrition plan') {
        const response = await api.post('/diet-plans', params || {});
        if (response.success) {
          toast.success('Diet plan created successfully');
          return true;
        }
      } else if (target === 'goal') {
        const response = await api.post('/goals', params || {});
        if (response.success) {
          toast.success('Goal created successfully');
          return true;
        }
      } else if (target === 'journal_entry' || target === 'journal') {
        const response = await api.post('/v1/wellbeing/journal', params || {});
        if (response.success) {
          window.dispatchEvent(new Event('journal-logged'));
          toast.success('Journal entry created');
          return true;
        }
      } else if (target === 'daily_checkin' || target === 'checkin') {
        const response = await api.post('/v1/journal/checkin', params || {});
        if (response.success) {
          window.dispatchEvent(new Event('checkin-completed'));
          toast.success('Daily check-in saved');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to create:', error);
      toast.error('Failed to create. Please try again.');
      return false;
    }
  }, []);

  const handleDelete = useCallback(async (target: string, params?: Record<string, unknown>): Promise<boolean> => {
    try {
      const id = params?.id || params?.planId || params?.goalId;
      if (!id) {
        toast.error(`${target} ID required for deletion`);
        return false;
      }

      // Confirm deletion
      const { confirm: confirmAction } = await import("@/components/common/ConfirmDialog");
      const confirmed = await confirmAction({
        title: `Delete ${target.charAt(0).toUpperCase() + target.slice(1)}`,
        description: `Are you sure you want to delete this ${target}? This action cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "destructive",
      });
      if (!confirmed) {
        return false;
      }

      if (target.includes('workout') || target === 'workout_plan') {
        const response = await api.delete(`/workouts/plans/${id}`);
        if (response.success) {
          toast.success('Workout plan deleted successfully');
          return true;
        }
      } else if (target.includes('diet') || target.includes('nutrition') || target === 'diet_plan') {
        const response = await api.delete(`/diet-plans/${id}`);
        if (response.success) {
          toast.success('Diet plan deleted successfully');
          return true;
        }
      } else if (target === 'goal') {
        const response = await api.delete(`/goals/${id}`);
        if (response.success) {
          toast.success('Goal deleted successfully');
          return true;
        }
      } else if (target === 'journal_entry' || target === 'journal') {
        const response = await api.delete(`/v1/wellbeing/journal/${id}`);
        if (response.success) {
          window.dispatchEvent(new Event('journal-logged'));
          toast.success('Journal entry deleted');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete. Please try again.');
      return false;
    }
  }, []);

  const handleOpenModal = useCallback(async (target: string, _params?: Record<string, unknown>): Promise<boolean> => {
    try {
      if (target === 'camera') {
        setImageModalMode("camera");
        setShowImageModal(true);
        return true;
      } else if (target === 'image_upload') {
        setImageModalMode("upload");
        setShowImageModal(true);
        return true;
      } else if (target === 'log_weight') {
        // Navigate to progress page which has weight logging modal
        router.push('/progress');
        // Trigger modal after navigation - this would need to be handled by ProgressTab
        // For now, just navigate and let user click the button
        toast.success('Navigate to Progress tab to log your weight');
        return true;
      } else if (target === 'log_measurement') {
        router.push('/progress');
        toast.success('Navigate to Progress tab to log your measurements');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to open modal:', error);
      return false;
    }
  }, [router]);

  const handleImageAnalysisComplete = useCallback(async (analysis: string, _imageUrl?: string) => {
    // Add analysis result as assistant message to the conversation
    if (analysis) {
      const analysisMessage: Message = {
        id: `analysis-${Date.now()}`,
        role: "assistant",
        content: analysis,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, analysisMessage]);
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  // Execute actions asynchronously
  const executeActionsAsync = useCallback(async (actions: ActionCommand[]) => {
    for (const action of actions) {
      const actionId = `${action.type}-${action.target}-${Date.now()}`;
      setExecutingActions(prev => new Set(prev).add(actionId));

      try {
        const result = await executeActions(
          [action],
          router,
          {
            onNavigate: handleNavigate,
            onUpdate: handleUpdate,
            onCreate: handleCreate,
            onDelete: handleDelete,
            onOpenModal: handleOpenModal,
          }
        );

        if (result[0]) {
          setActionResults(prev => {
            const newMap = new Map(prev);
            newMap.set(actionId, result[0]);
            return newMap;
          });

          // Show toast based on result
          if (result[0].success) {
            toast.success(result[0].message || `${action.type} completed successfully`);
          } else {
            toast.error(result[0].error || result[0].message || 'Action failed');
          }
        }
      } catch (error) {
        console.error('Error executing action:', error);
        toast.error('Failed to execute action');
      } finally {
        setExecutingActions(prev => {
          const newSet = new Set(prev);
          newSet.delete(actionId);
          return newSet;
        });
      }

      // Small delay between actions
      if (actions.indexOf(action) < actions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }, [router, handleNavigate, handleUpdate, handleCreate, handleDelete, handleOpenModal]);

  const deleteConversation = async (conversationId: string) => {
    try {
      await ragChatService.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
          setMessages([]);
        }
      } else {
        console.error("Failed to delete conversation:", error);
      }
    }
    setDropdownOpen(null);
  };

  const archiveConversation = async (conversationId: string) => {
    try {
      await ragChatService.archiveConversation(conversationId);
      fetchConversations();
    } catch (error) {
      console.error("Failed to archive conversation:", error);
    }
    setDropdownOpen(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden h-[calc(100vh-0px)] min-h-[500px] flex w-full relative"
    >
      {/* Backdrop for mobile sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Conversation Sidebar */}
      <AnimatePresence mode="wait">
        {showSidebar && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed lg:relative inset-y-0 left-0 z-50 w-[300px] border-r border-white/10 flex flex-col bg-slate-900/95 lg:bg-slate-900/50 backdrop-blur-lg lg:backdrop-blur-none"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <button
                onClick={startNewConversation}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                New Chat
              </button>
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading && conversations.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No conversations yet</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Start a new chat to begin
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                      activeConversationId === conv.id
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {conv.title || conv.lastMessagePreview || (conv.messageCount > 0 ? `Chat (${conv.messageCount})` : "New Chat")}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {conv.lastMessagePreview
                          ? `${conv.lastMessageRole === 'assistant' ? 'Aurea: ' : 'You: '}${conv.lastMessagePreview}`
                          : `${conv.messageCount} messages`}
                      </p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownOpen(dropdownOpen === conv.id ? null : conv.id);
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {dropdownOpen === conv.id && (
                        <div className="absolute right-0 top-8 z-50 w-36 bg-slate-800 rounded-lg border border-white/10 shadow-xl py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveConversation(conv.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard?tab=overview")}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Back to Overview"
              title="Back to Overview"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">Aurea</h3>
            <p className="text-xs text-slate-400 truncate">
              Powered by RAG • Always here to help
            </p>
          </div>
          <button
            onClick={() => router.push("/voice-assistant")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:border-rose-400/50 transition-all flex-shrink-0"
            title="Switch to Voice Assistant"
          >
            <Mic className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Voice Mode</span>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                How can I help you today?
              </h3>
              <p className="text-slate-400 max-w-md">
                I&apos;m Aurea, your AI health coach. Ask me about nutrition, workouts,
                wellness, or any health-related questions.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-md">
                {[
                  "What should I eat today?",
                  "Create a workout plan",
                  "How can I sleep better?",
                  "Tips for stress management",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(suggestion)}
                    className="p-3 text-left text-sm text-slate-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                        : "bg-white/5 text-slate-200 border border-white/10"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-2">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        {/* Action execution indicators */}
                        {(() => {
                          const messageActions = parseActionsFromResponse(message.content);
                          if (messageActions.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/5">
                                {messageActions.map((action, idx) => {
                                  const actionKey = `${action.type}-${action.target}-${idx}`;
                                  const isExecuting = Array.from(executingActions).some(id => id.includes(action.type) && id.includes(action.target));
                                  const result = Array.from(actionResults.values()).find(r => 
                                    r.action.type === action.type && r.action.target === action.target
                                  );
                                  
                                  return (
                                    <div
                                      key={actionKey}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                                    >
                                      {isExecuting ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                                          <span className="text-slate-400">Executing...</span>
                                        </>
                                      ) : result ? (
                                        <>
                                          {result.success ? (
                                            <>
                                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                              <span className="text-emerald-400">{result.message || 'Completed'}</span>
                                            </>
                                          ) : (
                                            <>
                                              <AlertCircle className="w-3 h-3 text-red-400" />
                                              <span className="text-red-400">{result.error || 'Failed'}</span>
                                            </>
                                          )}
                                        </>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {message.routingChip && (
                          <RoutingChip
                            chip={message.routingChip}
                            onReroute={async () => {
                              // Phase 1: reroute simply navigates to /life-areas.
                              // Full reroute endpoint is Phase 2.
                              window.location.href = '/life-areas';
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative flex items-end gap-2">
              <button
                onClick={() => {
                  setImageModalMode("upload");
                  setShowImageModal(true);
                }}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Upload image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setImageModalMode("camera");
                  setShowImageModal(true);
                }}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Take photo"
              >
                <Camera className="w-5 h-5" />
              </button>
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Aurea..."
                rows={1}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isSending}
              className={`p-3 rounded-xl transition-all ${
                inputMessage.trim() && !isSending
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
                  : "bg-white/5 text-slate-500 cursor-not-allowed"
              }`}
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Image Analysis Modal */}
      <ImageAnalysisModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onAnalysisComplete={handleImageAnalysisComplete}
        mode={imageModalMode}
        conversationId={activeConversationId || undefined}
      />
    </motion.div>
  );
}
