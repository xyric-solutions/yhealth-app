'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { Search, MessageSquare, Users, UserPlus, UserRoundPlus, MoreVertical, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { chatService, type Chat } from '@/src/shared/services/chat.service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/app/context/AuthContext';
import { useVoiceAssistant } from '@/app/context/VoiceAssistantContext';
import { JoinGroupDialog } from './JoinGroupDialog';
import { CreateGroupDialog } from './CreateGroupDialog';

interface ChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  refreshTrigger?: number;
}

export function ChatList({ selectedChatId, onSelectChat, refreshTrigger }: ChatListProps) {
  const { user } = useAuth();
  const { assistantName } = useVoiceAssistant();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => { toastRef.current = toast; }, [toast]);

  const isLoadingRef = useRef(false);

  const loadChats = useCallback(async () => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      const data = await chatService.getChats({ limit: 100 });
      setChats(data);
      hasLoadedRef.current = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (!msg.includes('429') && !msg.includes('rate limit')) {
        toastRef.current({ title: 'Error', description: 'Failed to load chats', variant: 'destructive' });
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current || refreshTrigger !== undefined) loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const getChatTitle = (chat: Chat): string => {
    if (chat.isGroupChat) return chat.chatName || 'Group Chat';
    if (chat.participants && user) {
      const other = chat.participants.find((p) => p.user && p.user.id !== user.id);
      if (other?.user) return `${other.user.firstName} ${other.user.lastName}`.trim() || other.user.email;
    }
    return assistantName || 'AI Coach';
  };

  const getChatAvatar = (chat: Chat): string | null => {
    if (chat.avatar) return chat.avatar;
    if (chat.isGroupChat) return null;
    if (chat.participants && user) {
      const other = chat.participants.find((p) => p.user && p.user.id !== user.id);
      if (other?.user?.avatar) return other.user.avatar;
    }
    return null;
  };

  const isAICoachChat = (chat: Chat): boolean => {
    if (chat.isGroupChat) return false;
    const title = getChatTitle(chat);
    return title === 'AI Coach' || title === assistantName || title === 'Aurea';
  };

  const getUnreadCount = (chat: Chat): number => {
    if (!chat.participants || !user) return 0;
    const p = chat.participants.find((p) => p.userId === user.id);
    return p?.unreadCount || 0;
  };

  const formatLastMessageTime = (dateString: string): string => {
    const date = new Date(dateString);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    if (isThisWeek(date)) return format(date, 'EEEE');
    if (isThisMonth(date)) return format(date, 'MMM d');
    return format(date, 'MMM d, yyyy');
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const title = getChatTitle(chat).toLowerCase();
    const lastMessage = chat.latestMessage?.content?.toLowerCase() || '';
    return title.includes(searchQuery.toLowerCase()) || lastMessage.includes(searchQuery.toLowerCase());
  });

  const groupedChats = filteredChats.reduce(
    (groups, chat) => {
      const date = new Date(chat.updatedAt || chat.createdAt);
      let group: string;
      if (isToday(date)) group = 'Today';
      else if (isYesterday(date)) group = 'Yesterday';
      else if (isThisWeek(date)) group = 'This Week';
      else if (isThisMonth(date)) group = 'This Month';
      else group = 'Older';
      if (!groups[group]) groups[group] = [];
      groups[group].push(chat);
      return groups;
    },
    {} as Record<string, Chat[]>
  );

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  // ── Loading skeleton ─────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full flex-col" style={{ background: 'linear-gradient(180deg, #080a12 0%, #060810 100%)' }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-md bg-white/[0.06]" />
          <Skeleton className="h-8 w-8 rounded-lg bg-white/[0.06]" />
        </div>
        <div className="px-4 pb-3">
          <Skeleton className="h-10 w-full rounded-xl bg-white/[0.04]" />
        </div>
        <div className="flex-1 px-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-white/[0.04]" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 rounded bg-white/[0.06]" style={{ width: `${60 + (i % 3) * 20}px` }} />
                <Skeleton className="h-3 rounded bg-white/[0.03]" style={{ width: `${120 + (i % 4) * 30}px` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'linear-gradient(180deg, #080a12 0%, #060810 100%)' }}>
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))',
              border: '1px solid rgba(16,185,129,0.2)',
            }}
          >
            <Image src="/logo1.png" alt="Balencia" width={22} height={22} className="object-contain" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Balencia</h2>
        </motion.div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl border-white/[0.08] bg-[#0f1120]/95 backdrop-blur-xl shadow-2xl shadow-black/50">
            <DropdownMenuItem onClick={() => setShowJoinDialog(true)} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]">
              <UserPlus className="mr-2 h-4 w-4" /> Join Group
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCreateDialog(true)} className="text-slate-300 hover:text-white focus:text-white focus:bg-white/[0.06]">
              <UserRoundPlus className="mr-2 h-4 w-4" /> Create Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="pl-10 pr-8 bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/20 rounded-xl h-10 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        {filteredChats.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <MessageSquare className="h-7 w-7 text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-400">{searchQuery ? 'No chats found' : 'No conversations yet'}</p>
            <p className="text-xs text-slate-600 mt-1">Start a new conversation</p>
          </motion.div>
        ) : (
          <div className="px-2 pb-4">
            {groupOrder.map((groupName) => {
              const groupChats = groupedChats[groupName];
              if (!groupChats || groupChats.length === 0) return null;

              return (
                <div key={groupName}>
                  <div className="px-3 pt-5 pb-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em]">{groupName}</span>
                    <div className="flex-1 h-[1px] bg-white/[0.03]" />
                  </div>
                  <AnimatePresence>
                    {groupChats.map((chat, i) => {
                      const isSelected = selectedChatId === chat.id;
                      const unreadCount = getUnreadCount(chat);
                      const title = getChatTitle(chat);
                      const avatar = getChatAvatar(chat);
                      const isAI = isAICoachChat(chat);
                      const rawLastMessage = chat.latestMessage?.content || '';
                      const lastMessage = rawLastMessage
                        .replace(/\*\*([^*]+)\*\*/g, '$1')
                        .replace(/\*([^*]+)\*/g, '$1')
                        .replace(/`([^`]+)`/g, '$1')
                        .replace(/#{1,6}\s/g, '')
                        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                        .replace(/\n+/g, ' ')
                        .trim();
                      const lastMessageTime = chat.updatedAt ? formatLastMessageTime(chat.updatedAt) : '';

                      return (
                        <motion.button
                          key={chat.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          onClick={() => onSelectChat(chat.id)}
                          className={cn(
                            'group relative flex w-full items-center gap-3 px-3 py-3 text-left rounded-xl',
                            'transition-all duration-200',
                            'hover:bg-white/[0.04]',
                            'active:scale-[0.98]',
                            isSelected && 'bg-white/[0.06]',
                          )}
                          style={isSelected ? {
                            boxShadow: `inset 0 0 0 1px rgba(${isAI ? '16,185,129' : '255,255,255'},0.1)`,
                          } : undefined}
                        >
                          {/* Selected indicator */}
                          {isSelected && (
                            <motion.div
                              layoutId="chatIndicator"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full"
                              style={{ background: isAI ? '#10b981' : 'rgba(255,255,255,0.3)' }}
                            />
                          )}

                          {/* Avatar */}
                          <div className="relative h-11 w-11 shrink-0 rounded-full">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt={title} className="h-full w-full object-cover rounded-full"
                                style={{ boxShadow: isAI ? '0 0 10px rgba(16,185,129,0.15)' : 'none', border: isAI ? '1.5px solid rgba(16,185,129,0.2)' : '1.5px solid rgba(255,255,255,0.06)' }} />
                            ) : chat.isGroupChat ? (
                              <div className="h-full w-full flex items-center justify-center rounded-full"
                                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))', border: '1.5px solid rgba(16,185,129,0.15)' }}>
                                <Users className="h-4.5 w-4.5 text-emerald-400" />
                              </div>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center rounded-full"
                                style={{
                                  background: isAI ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.15))' : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
                                  border: isAI ? '1.5px solid rgba(16,185,129,0.2)' : '1.5px solid rgba(255,255,255,0.06)',
                                }}>
                                {isAI ? (
                                  <Sparkles className="h-5 w-5 text-emerald-400" />
                                ) : (
                                  <span className="text-sm font-semibold text-white/70">{title.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                            )}
                            {/* Online / AI indicator */}
                            {isAI && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#080a12]"
                                style={{ boxShadow: '0 0 4px rgba(16,185,129,0.5)' }} />
                            )}
                            {/* Unread badge */}
                            {unreadCount > 0 && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                className="absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white px-1 ring-2 ring-[#080a12]">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </motion.div>
                            )}
                          </div>

                          {/* Chat Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <h3 className={cn(
                                'truncate font-semibold text-[14px]',
                                isSelected ? (isAI ? 'text-emerald-400' : 'text-white') : 'text-slate-200'
                              )}>
                                {title}
                              </h3>
                              {lastMessageTime && (
                                <span className={cn(
                                  'shrink-0 text-[10px] font-medium',
                                  unreadCount > 0 ? 'text-emerald-400' : 'text-slate-600'
                                )}>
                                  {lastMessageTime}
                                </span>
                              )}
                            </div>
                            {lastMessage && (
                              <p className={cn(
                                'line-clamp-1 text-[12px] leading-relaxed',
                                unreadCount > 0 ? 'text-slate-300 font-medium' : 'text-slate-500'
                              )}>
                                {lastMessage}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Dialogs */}
      <JoinGroupDialog isOpen={showJoinDialog} onClose={() => setShowJoinDialog(false)}
        onJoinSuccess={async (chat) => { hasLoadedRef.current = false; isLoadingRef.current = false; await loadChats(); onSelectChat(chat.id); setShowJoinDialog(false); }} />
      <CreateGroupDialog isOpen={showCreateDialog} onClose={() => setShowCreateDialog(false)}
        onGroupCreated={async (chat) => { hasLoadedRef.current = false; isLoadingRef.current = false; await loadChats(); onSelectChat(chat.id); }} />
    </div>
  );
}
