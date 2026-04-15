'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageCircle,
  X,
  Smile,
  Reply,
  Trash2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/context/AuthContext';
import { api } from '@/lib/api-client';
import { getSocket } from '@/lib/socket-client';
import { formatDistanceToNow } from 'date-fns';

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  id: string;
  competition_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  user?: { name: string; avatar?: string };
  reactions?: Record<string, string[]>;
  reply_to?: { id: string; user_name: string; content: string } | null;
}

interface CompetitionLiveChatProps {
  competitionId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

// Quick reaction emojis
const QUICK_REACTIONS = ['👍', '❤️', '🔥', '💪', '🎉', '😂'];

// ============================================
// COMPONENT
// ============================================

export function CompetitionLiveChat({
  competitionId,
  isOpen = true,
  onClose,
}: CompetitionLiveChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Check if user is scrolled to bottom
  const checkScrollPosition = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const threshold = 100;
    isAtBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    setShowNewMessageIndicator(false);
  }, []);

  // Load message history from API
  const loadHistory = useCallback(async (before?: string) => {
    setIsLoadingHistory(true);
    try {
      const params: Record<string, string | number> = { limit: 50 };
      if (before) params.before = before;

      const response = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
        `/competitions/${competitionId}/chat`,
        { params }
      );

      if (response.success && response.data) {
        const incoming = response.data.messages;
        setHasMore(response.data.hasMore);

        if (before) {
          // Prepend older messages
          setMessages((prev) => [...incoming, ...prev]);
        } else {
          // Initial load
          setMessages(incoming);
        }
      }
    } catch (error) {
      console.error('[CompetitionChat] Failed to load history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [competitionId]);

  // Load initial history
  useEffect(() => {
    if (isOpen && competitionId) {
      loadHistory();
    }
  }, [isOpen, competitionId, loadHistory]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && !isLoadingHistory) {
      scrollToBottom(false);
    }
    // Only run on initial load, not every message update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingHistory]);

  // Socket.IO real-time events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !competitionId) return;

    // Join the competition chat room
    socket.emit('joinChat', `competition:${competitionId}`);

    const handleNewMessage = (data: ChatMessage) => {
      if (data.competition_id !== competitionId) return;
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === data.id)) return prev;
        // Skip own messages while an optimistic (temp-*) version exists —
        // the HTTP response handler will replace the optimistic entry.
        if (data.user_id === user?.id && prev.some((m) => m.id.startsWith('temp-'))) {
          return prev;
        }
        return [...prev, data];
      });

      // Auto-scroll or show indicator
      if (isAtBottomRef.current) {
        setTimeout(() => scrollToBottom(), 50);
      } else {
        setShowNewMessageIndicator(true);
      }
    };

    const handleReaction = (data: { messageId: string; emoji: string; userId: string; action: 'add' | 'remove'; reactions?: Record<string, string[]> }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== data.messageId) return msg;

          // If server sent the full reactions map, use it directly
          if (data.reactions) {
            return { ...msg, reactions: data.reactions };
          }

          const reactions = msg.reactions ? { ...msg.reactions } : {};
          const users = reactions[data.emoji] ? [...reactions[data.emoji]] : [];

          if (data.action === 'add' && !users.includes(data.userId)) {
            users.push(data.userId);
          } else if (data.action === 'remove') {
            const idx = users.indexOf(data.userId);
            if (idx >= 0) users.splice(idx, 1);
          }

          if (users.length > 0) {
            reactions[data.emoji] = users;
          } else {
            delete reactions[data.emoji];
          }

          return { ...msg, reactions };
        })
      );
    };

    const handleDelete = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    socket.on('competition:chat:message', handleNewMessage);
    socket.on('competition:chat:reaction', handleReaction);
    socket.on('competition:chat:delete', handleDelete);

    return () => {
      socket.off('competition:chat:message', handleNewMessage);
      socket.off('competition:chat:reaction', handleReaction);
      socket.off('competition:chat:delete', handleDelete);
      socket.emit('leaveChat', `competition:${competitionId}`);
    };
  }, [competitionId, scrollToBottom, user?.id]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    const content = newMessage.trim();
    if (content.length > 500) return;

    setIsSending(true);
    setNewMessage('');

    // Optimistic message
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      competition_id: competitionId,
      user_id: user.id,
      content,
      reply_to_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      user: { name: `${user.firstName} ${user.lastName}`.trim(), avatar: user.avatarUrl || undefined },
      reactions: {},
      reply_to: replyTo ? { id: replyTo.id, user_name: replyTo.user?.name || 'User', content: replyTo.content } : null,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyTo(null);
    scrollToBottom();

    try {
      const body: Record<string, string> = { content };
      if (replyTo) body.replyToId = replyTo.id;

      const response = await api.post<{ message: ChatMessage }>(
        `/competitions/${competitionId}/chat`,
        body
      );

      if (response.success && response.data?.message) {
        const realMsg = response.data.message;
        // Replace optimistic message with the real one, and remove any
        // socket-delivered duplicate that may have arrived in the meantime.
        setMessages((prev) => {
          const cleaned = prev.filter(
            (m) => m.id !== optimisticMsg.id && m.id !== realMsg.id,
          );
          return [...cleaned, realMsg];
        });
      }
    } catch (error) {
      console.error('[CompetitionChat] Failed to send message:', error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setNewMessage(content); // Restore message
    } finally {
      setIsSending(false);
    }
  };

  // Add reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setShowReactions(null);

    // Check if user already reacted
    const msg = messages.find((m) => m.id === messageId);
    const hasReacted = msg?.reactions?.[emoji]?.includes(user.id);

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions: Record<string, string[]> = m.reactions ? { ...m.reactions } : {};
        const users = reactions[emoji] ? [...reactions[emoji]] : [];

        if (hasReacted) {
          const idx = users.indexOf(user.id);
          if (idx >= 0) users.splice(idx, 1);
        } else {
          users.push(user.id);
        }

        if (users.length > 0) {
          reactions[emoji] = users;
        } else {
          delete reactions[emoji];
        }
        return { ...m, reactions };
      })
    );

    try {
      if (hasReacted) {
        await api.delete(`/competitions/${competitionId}/chat/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      } else {
        await api.post(`/competitions/${competitionId}/chat/${messageId}/reactions`, { emoji });
      }
    } catch (error) {
      console.error('[CompetitionChat] Reaction failed:', error);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;

    // Optimistic delete
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      await api.delete(`/competitions/${competitionId}/chat/${messageId}`);
    } catch (error) {
      console.error('[CompetitionChat] Delete failed:', error);
      // Reload messages to restore state
      loadHistory();
    }
  };

  // Load more (older messages)
  const loadMore = () => {
    if (messages.length > 0 && hasMore) {
      loadHistory(messages[0].created_at);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col h-[600px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
            <motion.div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Live Chat</h3>
            <p className="text-gray-500 text-xs">{messages.length} messages</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        onScroll={checkScrollPosition}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {/* Load more button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              onClick={loadMore}
              disabled={isLoadingHistory}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              {isLoadingHistory ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </span>
              ) : (
                'Load older messages'
              )}
            </button>
          </div>
        )}

        <AnimatePresence>
          {messages.length === 0 && !isLoadingHistory ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-emerald-400/60" />
              </div>
              <p className="text-gray-400 text-sm font-medium">No messages yet</p>
              <p className="text-gray-600 text-xs mt-1">Be the first to start the conversation!</p>
            </motion.div>
          ) : (
            messages.map((message) => {
              const isCurrentUser = message.user_id === user?.id;
              const reactions = message.reactions || {};
              const hasReactions = Object.keys(reactions).length > 0;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                  className={cn(
                    'group relative flex gap-2.5',
                    isCurrentUser && 'flex-row-reverse'
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="w-8 h-8 border border-white/10 flex-shrink-0 mt-0.5">
                    <AvatarImage src={message.user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 text-emerald-300 text-xs font-medium">
                      {(message.user?.name || 'U').charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message content */}
                  <div className={cn('flex flex-col gap-1 max-w-[75%]', isCurrentUser && 'items-end')}>
                    {/* Name + Time */}
                    <div className={cn('flex items-center gap-2', isCurrentUser && 'flex-row-reverse')}>
                      <span className="text-xs font-medium text-gray-300">
                        {message.user?.name || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Reply context */}
                    {message.reply_to && (
                      <div className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border-l-2 border-emerald-500/50',
                        isCurrentUser ? 'bg-emerald-500/10' : 'bg-white/5'
                      )}>
                        <Reply className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        <span className="text-emerald-400 font-medium">{message.reply_to.user_name}</span>
                        <span className="text-gray-500 truncate">{message.reply_to.content}</span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={cn(
                        'relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        isCurrentUser
                          ? 'bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 text-white rounded-tr-md'
                          : 'bg-white/[0.06] text-gray-200 rounded-tl-md border border-white/[0.06]'
                      )}
                    >
                      {message.content}

                      {/* Hover actions */}
                      <div className={cn(
                        'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5',
                        isCurrentUser ? '-left-20' : '-right-20'
                      )}>
                        <button
                          onClick={() => setShowReactions(showReactions === message.id ? null : message.id)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="React"
                        >
                          <Smile className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => setReplyTo(message)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="Reply"
                        >
                          <Reply className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        {isCurrentUser && (
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reaction picker */}
                    <AnimatePresence>
                      {showReactions === message.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -5 }}
                          className="flex gap-0.5 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-full px-2 py-1 shadow-xl"
                        >
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message.id, emoji)}
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-sm hover:bg-white/10 transition-all hover:scale-110',
                                reactions[emoji]?.includes(user?.id || '') && 'bg-emerald-500/20'
                              )}
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Reaction chips */}
                    {hasReactions && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(reactions).map(([emoji, userIds]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(message.id, emoji)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all',
                              userIds.includes(user?.id || '')
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                            )}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* New messages indicator */}
      <AnimatePresence>
        {showNewMessageIndicator && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-full shadow-lg hover:bg-emerald-500 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            New messages
          </motion.button>
        )}
      </AnimatePresence>

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border-t border-white/[0.06]">
              <Reply className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-emerald-400 font-medium">{replyTo.user?.name || 'User'}</span>
                <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      {user ? (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={replyTo ? 'Write a reply...' : 'Type a message...'}
              className="flex-1 bg-white/[0.05] border-white/[0.08] text-white placeholder:text-gray-600 rounded-xl focus:ring-emerald-500/30 focus:border-emerald-500/30"
              disabled={isSending}
              maxLength={500}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              size="icon"
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-30"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {newMessage.length > 400 && (
            <p className={cn(
              'text-[10px] mt-1 text-right',
              newMessage.length > 480 ? 'text-red-400' : 'text-gray-500'
            )}>
              {newMessage.length}/500
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-white/[0.06] text-center">
          <p className="text-gray-500 text-sm">Sign in to join the conversation</p>
        </div>
      )}
    </motion.div>
  );
}
