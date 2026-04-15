'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { type ChatMessageItemData } from './ChatMessageItem';
import { ChatInput } from './ChatInput';
import { ConversationSidebar } from './ConversationSidebar';
import { EmptyState } from '@/components/chat';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import type { RAGConversation, RAGChatMessage } from '@/src/shared/services/rag-chat.service';
import { ragChatService } from '@/src/shared/services/rag-chat.service';

interface ChatContainerProps {
  className?: string;
}

const WELCOME_SUGGESTIONS = [
  "I want to lose weight healthily",
  "Help me build a workout routine",
  "How can I improve my sleep?",
  "What should I eat for more energy?",
  "I need help managing stress",
  "Create a nutrition plan for muscle gain",
];

export function ChatContainer({ className }: ChatContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<RAGConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    content: string;
    senderName?: string;
    mediaType?: string;
  } | null>(null);

  // Load conversations on mount
  useEffect(() => {
    const initializeChat = async () => {
      const convId = searchParams.get('id');
      if (convId) {
        await loadConversation(convId);
        await loadConversations();
      } else {
        const { conversations: convs } = await ragChatService.getConversations({ limit: 50 });
        setConversations(convs);
        setIsInitialLoad(false);

        if (convs && convs.length > 0) {
          const lastConversation = convs[0];
          setActiveConversationId(lastConversation.id);
          router.push(`/chat?id=${lastConversation.id}`);
          await loadConversation(lastConversation.id);
        }
      }
    };

    initializeChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle conversation ID from URL
  useEffect(() => {
    if (isInitialLoad) return;

    const convId = searchParams.get('id');
    if (convId && convId !== activeConversationId) {
      loadConversation(convId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isInitialLoad, activeConversationId]);

  const loadConversations = async () => {
    try {
      const { conversations: convs } = await ragChatService.getConversations({ limit: 50 });
      setConversations(convs);
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
      setIsInitialLoad(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    setIsLoading(true);
    try {
      const data = await ragChatService.getConversation(conversationId);
      setActiveConversationId(conversationId);
      setMessages(convertMessages(data.messages));
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const convertMessages = (ragMessages: RAGChatMessage[]): ChatMessageItemData[] => {
    return ragMessages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt,
    }));
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    router.push('/chat');
  };

  const handleSelectConversation = (id: string) => {
    router.push(`/chat?id=${id}`);
    loadConversation(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await ragChatService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        handleNewConversation();
      }
      toast({
        title: 'Deleted',
        description: 'Conversation deleted',
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    }
  };

  const handleArchiveConversation = async (id: string) => {
    try {
      await ragChatService.archiveConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        handleNewConversation();
      }
      toast({
        title: 'Archived',
        description: 'Conversation archived',
      });
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive conversation',
        variant: 'destructive',
      });
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadConversations();
      return;
    }
    const { conversations: convs } = await ragChatService.getConversations({ limit: 50 });
    const filtered = convs.filter(
      (c) =>
        c.title?.toLowerCase().includes(query.toLowerCase()) ||
        c.topics.some((t) => t.toLowerCase().includes(query.toLowerCase()))
    );
    setConversations(filtered);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (
    message: string,
    options?: { mediaFiles?: File[]; repliedToId?: string; gifUrl?: string }
  ) => {
    if (!message.trim() && (!options?.mediaFiles || options.mediaFiles.length === 0) && !options?.gifUrl || isSending)
      return;

    // For now, only text messages are supported in RAG chat
    // Media support can be added later

    const tempUserMessage: ChatMessageItemData = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: options?.gifUrl ? '' : message,
      timestamp: new Date().toISOString(),
      ...(options?.gifUrl && { contentType: 'gif', mediaUrl: options.gifUrl, mediaType: 'gif' as const }),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setIsSending(true);
    setReplyTo(null);

    try {
      const response = await ragChatService.sendMessage({
        message: options?.gifUrl ? `[User sent a GIF]` : message,
        conversationId: activeConversationId || undefined,
      });

      if (!activeConversationId) {
        setActiveConversationId(response.conversationId);
        router.push(`/chat?id=${response.conversationId}`);

        ragChatService.generateTitle(response.conversationId).then(() => {
          loadConversations();
        });
      }

      const assistantMessage: ChatMessageItemData = {
        id: response.messageId,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className={cn('flex h-[calc(100vh-0rem)] overflow-hidden', className)}>
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-20 z-50 md:hidden"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        {showSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          'absolute z-40 h-full transition-transform md:relative md:translate-x-0',
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId || undefined}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          onArchive={handleArchiveConversation}
          onSearch={handleSearch}
          isLoading={isInitialLoad}
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        {activeConversationId && (
          <ChatHeader
            title={activeConversation?.title || 'Aurea'}
            subtitle="Your personal AI health and fitness coach"
          />
        )}

        {/* Messages */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            title="Aurea"
            description="I'm Aurea, your personal AI-powered health and fitness coach. Ask me anything about nutrition, workouts, sleep, stress management, and more."
            suggestions={WELCOME_SUGGESTIONS}
            onSuggestionClick={handleSuggestionClick}
          />
        ) : (
          <ChatMessagesList messages={messages} isLoading={isSending} />
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          isLoading={isSending}
          disabled={isLoading}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
}

