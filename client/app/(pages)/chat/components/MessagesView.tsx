'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { ChatInput } from './ChatInput';
import { ChatEmptyState } from './ChatEmptyState';
import { GroupInfoModal } from './GroupInfoModal';
import { EditChatDialog } from './EditChatDialog';
import { ForwardMessageDialog } from './ForwardMessageDialog';
import { ViewOnceViewer } from './ViewOnceViewer';
import { UserHealthProfileModal } from './UserHealthProfileModal';
import { chatService, type Chat } from '@/src/shared/services/chat.service';
import { type ChatMessageItemData } from './ChatMessageItem';
import { adaptMessageToChatMessageItem } from '../utils/messageAdapter';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/app/context/AuthContext';
import { subscribeToChatEvents, subscribeToUserEvents } from '@/lib/socket-client';
import { useVoiceAssistant } from '@/app/context/VoiceAssistantContext';

interface MessagesViewProps {
  chatId: string | null;
  onBack?: () => void;
  onMenuClick?: () => void;
  onChatDeleted?: () => void;
  onChatRead?: () => void; // Callback when chat is marked as read
}

export function MessagesView({ chatId, onBack, onMenuClick, onChatDeleted, onChatRead }: MessagesViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { assistantName } = useVoiceAssistant();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const [chat, setChat] = useState<Chat | null>(null);
  const isAiChatRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessageItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<{
    id: string;
    content: string;
    senderName?: string;
    mediaType?: string;
  } | null>(null);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
    avatar?: string | null;
  } | null>(null);
  const [viewOnceMedia, setViewOnceMedia] = useState<{
    messageId: string;
    mediaUrl: string;
    mediaThumbnail?: string;
    mediaType: 'image' | 'video' | 'audio';
  } | null>(null);

  // Keep toast ref up to date
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Helper function to reload messages
  const reloadMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const [chatData, messagesData] = await Promise.all([
        chatService.getChatById(chatId),
        chatService.getMessages(chatId, { limit: 50 }),
      ]);
      setChat(chatData);
      // Backend already returns messages in chronological order (oldest first)
      const adaptedMessages = messagesData
        .map((msg) => adaptMessageToChatMessageItem(msg, user?.id, isAiChatRef.current));
      setMessages(adaptedMessages);
    } catch (error) {
      console.error('Failed to reload messages:', error);
    }
  }, [chatId, user?.id]);

  // Load chat details and messages when chatId changes
  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadChatAndMessages = async () => {
      try {
        setIsLoading(true);

        // Load chat details and messages in parallel
        const [chatData, messagesData] = await Promise.all([
          chatService.getChatById(chatId),
          chatService.getMessages(chatId, { limit: 50 }),
        ]);

        if (cancelled) return;

        setChat(chatData);

        // Detect AI Coach chat (other participant has system email)
        isAiChatRef.current = !chatData.isGroupChat && !!chatData.participants?.some(
          (p) => p.user?.email?.includes('ai-coach') || p.user?.email?.includes('balencia.system')
        );

        // Convert messages to ChatMessageItemData format
        // Backend already returns messages in chronological order (oldest first)
        const adaptedMessages = messagesData
          .map((msg) => adaptMessageToChatMessageItem(msg, user?.id, isAiChatRef.current));

        setMessages(adaptedMessages);

        // Mark chat as read (fire-and-forget, don't block rendering)
        chatService.markChatAsRead(chatId).then(() => {
          if (!cancelled) onChatRead?.();
        }).catch((error) => {
          console.error('Failed to mark chat as read:', error);
        });
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load chat:', error);
        toastRef.current({
          title: 'Error',
          description: 'Failed to load chat messages',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadChatAndMessages();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user?.id]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!chatId || !user?.id) return;

    // Subscribe to chat events
    const cleanupChat = subscribeToChatEvents(chatId, {
      onNewMessage: async (_data) => {
        try {
          // Reload messages to get the latest state with all relations
          const messagesData = await chatService.getMessages(chatId, { limit: 50 });
          // Backend already returns messages in chronological order (oldest first)
          const adaptedMessages = messagesData
            .map((msg) => adaptMessageToChatMessageItem(msg, user.id, isAiChatRef.current));
          setMessages(adaptedMessages);
        } catch (error) {
          console.error('Failed to reload messages after new message event:', error);
        }
      },
      onMessageEdited: async (_data) => {
        try {
          // Reload messages to get updated message
          const messagesData = await chatService.getMessages(chatId, { limit: 50 });
          // Backend already returns messages in chronological order (oldest first)
          const adaptedMessages = messagesData
            .map((msg) => adaptMessageToChatMessageItem(msg, user.id, isAiChatRef.current));
          setMessages(adaptedMessages);
        } catch (error) {
          console.error('Failed to reload messages after edit event:', error);
        }
      },
      onMessageDeleted: (data) => {
        // Update the message in place to mark it as deleted instead of reloading all messages
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, isDeleted: true, content: 'This message was deleted', contentType: 'deleted' }
              : msg
          )
        );
      },
      onMessageReaction: async (_data) => {
        try {
          // Reload messages to get updated reactions
          const messagesData = await chatService.getMessages(chatId, { limit: 50 });
          // Backend already returns messages in chronological order (oldest first)
          const adaptedMessages = messagesData
            .map((msg) => adaptMessageToChatMessageItem(msg, user.id, isAiChatRef.current));
          setMessages(adaptedMessages);
        } catch (error) {
          console.error('Failed to reload messages after reaction event:', error);
        }
      },
      onTyping: (data) => {
        if (data.userId && data.userId !== user?.id) {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.add(data.userId!);
            return newSet;
          });
        }
      },
      onStopTyping: (data) => {
        if (data.userId) {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(data.userId!);
            return newSet;
          });
        }
      },
      onUserLeftGroup: async (_data) => {
        try {
          // Reload chat to get updated participant list
          const chatData = await chatService.getChatById(chatId);
          setChat(chatData);
          toast({
            title: 'User Left',
            description: 'A member has left the group',
          });
        } catch (error) {
          console.error('Failed to reload chat after user left event:', error);
        }
      },
      onUserJoinedGroup: async (_data) => {
        try {
          // Reload messages to show the new system message
          const messagesData = await chatService.getMessages(chatId, { limit: 50 });
          const adaptedMessages = messagesData
            .map((msg) => adaptMessageToChatMessageItem(msg, user.id, isAiChatRef.current));
          setMessages(adaptedMessages);
          // Reload chat to get updated participant list
          const chatData = await chatService.getChatById(chatId);
          setChat(chatData);
        } catch (error) {
          console.error('Failed to reload chat after user joined event:', error);
        }
      },
      onMessagesRead: (data) => {
        // When another user reads messages, update readBy on all user's sent messages
        if (data.userId && data.userId !== user?.id) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.role === 'user' && msg.senderId === user?.id) {
                const currentReadBy = msg.readBy || [];
                if (!currentReadBy.includes(data.userId)) {
                  return { ...msg, readBy: [...currentReadBy, data.userId] };
                }
              }
              return msg;
            })
          );
        }
      },
      onViewOnceOpened: (data) => {
        // Update the message locally to show "Opened" state (sender sees this)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, viewOnceOpenedAt: data.openedAt, mediaUrl: undefined, mediaThumbnail: undefined }
              : msg
          )
        );
      },
    });

    return cleanupChat;
  }, [chatId, user?.id, toast]);

  // Subscribe to user-level events (like groupLeft)
  useEffect(() => {
    if (!user?.id) return;

    const cleanupUser = subscribeToUserEvents({
      onGroupLeft: (data) => {
        // User has left a group - redirect to chat overview
        toast({
          title: 'Left Group',
          description: `You have left "${data.chatName}"`,
        });
        onChatDeleted?.();
        router.push('/chat');
      },
    });

    return () => {
      if (cleanupUser) cleanupUser();
    };
  }, [user?.id, toast, onChatDeleted, router]);

  const getChatTitle = (chat: Chat | null): string => {
    if (!chat) return 'Chat';

    if (chat.isGroupChat) {
      return chat.chatName || 'Group Chat';
    }

    if (chat.participants && user) {
      const otherParticipant = chat.participants.find(
        (p) => p.user && p.user.id !== user.id
      );
      if (otherParticipant?.user) {
        const firstName = otherParticipant.user.firstName || '';
        const lastName = otherParticipant.user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || otherParticipant.user.email || 'Chat';
      }
    }

    // For 1-on-1 chats with no other participant (AI coach), use assistant name
    return assistantName || 'AI Coach';
  };

  const getChatSubtitle = (chat: Chat | null): string | undefined => {
    if (!chat || chat.isGroupChat) return undefined;

    if (chat.participants && user) {
      const otherParticipant = chat.participants.find(
        (p) => p.user && p.user.id !== user.id
      );
      if (otherParticipant?.user?.email) {
        return otherParticipant.user.email;
      }
    }

    // AI coach chat — show descriptive subtitle
    return 'AI Health Coach';
  };

  // Check if user is admin or creator
  const isAdmin = chat?.groupAdmin === user?.id;
  const isCreator = chat?.createdBy === user?.id;
  const isGroupAdmin = isAdmin || isCreator;

  // Calculate if user can send messages (for group permissions)
  const canSendMessages = useMemo(() => {
    if (!chat?.isGroupChat || chat.messagePermissionMode !== 'restricted') {
      return true;
    }
    if (isGroupAdmin) return true;
    const allowedSenderIds = chat.allowedSenderIds || [];
    return allowedSenderIds.includes(user?.id || '');
  }, [chat, user?.id, isGroupAdmin]);

  const permissionDeniedMessage = useMemo(() => {
    if (!chat?.isGroupChat || chat.messagePermissionMode !== 'restricted') {
      return undefined;
    }
    if (!canSendMessages) {
      return "You don't have permission to send messages in this group";
    }
    return undefined;
  }, [chat, canSendMessages]);

  // Handler for editing chat/group name
  const handleEditChat = useCallback(() => {
    setShowEditDialog(true);
  }, []);

  // Handler for closing chat (just navigate back, don't leave/delete)
  const handleCloseChat = useCallback(() => {
    onChatDeleted?.();
    // Redirect to chat overview page
    router.push('/chat');
  }, [onChatDeleted, router]);

  // Handler for leaving group (remove user from group)
  // Only available for non-admin members
  const handleLeaveGroup = useCallback(async () => {
    if (!chatId || !chat || !user?.id || !chat.isGroupChat) return;
    
    // Prevent admins/creators from leaving - they must delete the group instead
    if (isGroupAdmin) {
      toast({
        title: 'Cannot Leave',
        description: 'Group admins cannot leave the group. Please delete the group instead.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await chatService.leaveGroupChat(chatId, user.id);
      toast({
        title: 'Success',
        description: 'You have left the group',
      });
      onChatDeleted?.();
      // Redirect to chat overview page
      router.push('/chat');
    } catch (error) {
      console.error('Failed to leave group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave group';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [chatId, chat, user?.id, toast, onChatDeleted, router, isGroupAdmin]);

  // Handler for deleting chat/group
  const handleDeleteChat = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  // Confirm delete handler
  const handleConfirmDelete = useCallback(async () => {
    if (!chatId || !chat) return;

    try {
      if (chat.isGroupChat) {
        // Use deleteGroup for group chats (admin/creator only)
        await chatService.deleteGroup(chatId);
        toast({
          title: 'Success',
          description: 'Group deleted successfully',
        });
      } else {
        // Use deleteChat for one-on-one chats
        await chatService.deleteChat(chatId);
        toast({
          title: 'Success',
          description: 'Chat deleted successfully',
        });
      }
      setShowDeleteConfirm(false);
      onChatDeleted?.();
      onBack?.();
    } catch (error) {
      console.error('Failed to delete chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete chat';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [chatId, chat, toast, onChatDeleted, onBack]);

  // Handler for chat updated (after rename)
  const handleChatUpdated = useCallback(() => {
    reloadMessages();
  }, [reloadMessages]);

  const handleSendMessage = useCallback(
    async (message: string, options?: { mediaFiles?: File[]; repliedToId?: string; isViewOnce?: boolean; gifUrl?: string }) => {
      if (!chatId || (!message.trim() && !options?.mediaFiles?.length && !options?.gifUrl)) return;

      try {
        setIsSending(true);

        let mediaUrl: string | undefined;
        let mediaThumbnail: string | undefined;
        let mediaSize: number | undefined;
        let contentType: string = 'text';

        // Handle GIF sending (no upload needed — direct URL)
        if (options?.gifUrl) {
          contentType = 'gif';
          mediaUrl = options.gifUrl;
        }

        // Handle media upload if files are provided
        if (options?.mediaFiles && options.mediaFiles.length > 0) {
          const file = options.mediaFiles[0]; // Handle first file for now
          
          try {
            const uploadResult = await chatService.uploadMedia(file);

            // Determine content type from file
            if (file.type.startsWith('image/')) contentType = 'image';
            else if (file.type.startsWith('video/')) contentType = 'video';
            else if (file.type.startsWith('audio/')) contentType = 'audio';
            else contentType = 'document';

            mediaUrl = uploadResult.url;
            mediaThumbnail = uploadResult.thumbnail;
            mediaSize = file.size;
          } catch (uploadError: unknown) {
            // Handle upload errors specifically
            // ApiError has message, code, and status properties
            // Also check axios error response structure
            const err = uploadError as { message?: string; code?: string; response?: { data?: { message?: string; code?: string; error?: { message?: string; code?: string } } } };
            const errorMessage =
              err?.message ||
              err?.response?.data?.message ||
              err?.response?.data?.error?.message ||
              'Failed to upload file';
            const errorCode =
              err?.code ||
              err?.response?.data?.code ||
              err?.response?.data?.error?.code;
            
            console.error('File upload error:', {
              message: errorMessage,
              code: errorCode,
              error: uploadError
            });
            
            toast({
              title: errorCode === 'FILE_TOO_LARGE' ? 'File Too Large' : 'Upload Failed',
              description: errorMessage,
              variant: 'destructive',
            });
            
            setIsSending(false);
            return; // Stop message sending if upload fails
          }
        }

        // Send message
        // Only include content if there's text, otherwise omit it for media-only messages
        const messagePayload: {
          chatId: string;
          content?: string;
          contentType: string;
          mediaUrl?: string;
          mediaThumbnail?: string;
          mediaSize?: number;
          repliedTo?: string;
          isViewOnce?: boolean;
        } = {
          chatId,
          contentType,
        };

        // Only include content if there's text
        const trimmedContent = message.trim();
        if (trimmedContent) {
          messagePayload.content = trimmedContent;
        }

        // Include media fields if media was uploaded
        if (mediaUrl) {
          messagePayload.mediaUrl = mediaUrl;
          if (mediaThumbnail) {
            messagePayload.mediaThumbnail = mediaThumbnail;
          }
          if (mediaSize) {
            messagePayload.mediaSize = mediaSize;
          }
        }

        // Include reply if present
        if (options?.repliedToId) {
          messagePayload.repliedTo = options.repliedToId;
        }

        // Include view-once flag if set
        if (options?.isViewOnce) {
          messagePayload.isViewOnce = true;
        }

        const sentMessage = await chatService.sendMessage(messagePayload);

        // Convert and add to messages
        const adaptedMessage = adaptMessageToChatMessageItem(sentMessage, user?.id, isAiChatRef.current);
        setMessages((prev) => [...prev, adaptedMessage]);

        setReplyTo(null);
      } catch (error) {
        console.error('Failed to send message:', error);
        toast({
          title: 'Error',
          description: 'Failed to send message',
          variant: 'destructive',
        });
      } finally {
        setIsSending(false);
      }
    },
    [chatId, user?.id, toast]
  );

  const handleViewOnce = useCallback(async (messageId: string) => {
    try {
      const result = await chatService.openViewOnceMessage(messageId);
      const message = messages.find((m) => m.id === messageId);
      const mediaType = (message?.mediaType || 'image') as 'image' | 'video' | 'audio';

      // Open the viewer
      setViewOnceMedia({
        messageId,
        mediaUrl: result.mediaUrl,
        mediaThumbnail: result.mediaThumbnail,
        mediaType,
      });

      // Update the message locally to mark as opened
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, viewOnceOpenedAt: new Date().toISOString(), mediaUrl: undefined, mediaThumbnail: undefined }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to open view-once message:', error);
      toast({
        title: 'Error',
        description: 'Failed to open view-once message',
        variant: 'destructive',
      });
    }
  }, [messages, toast]);

  const handleCloseViewOnce = useCallback(() => {
    setViewOnceMedia(null);
  }, []);

  const handleReply = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setReplyTo({
        id: message.id,
        content: message.content,
        senderName: message.role === 'user' ? 'You' : undefined,
        mediaType: message.mediaType,
      });
    }
  }, [messages]);

  const handleEdit = useCallback(async (messageId: string) => {
    // TODO: Implement edit functionality
    console.log('Edit message:', messageId);
  }, []);

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      // Optimistically update the message to show it's deleted
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, isDeleted: true, content: 'This message was deleted', contentType: 'deleted' }
            : msg
        )
      );
      
      await chatService.deleteMessage(messageId);
      
      // The socket event will handle the final update, but we show success immediately
      toast({
        title: 'Success',
        description: 'Message deleted',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      // Reload messages to get correct state on error
      await reloadMessages();
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    }
  }, [toast, reloadMessages]);

  const handleForward = useCallback((messageId: string) => {
    setForwardMessageId(messageId);
    setShowForwardDialog(true);
  }, []);

  const handleForwardSuccess = useCallback(async () => {
    // Reload messages to show the forwarded message in other chats
    await reloadMessages();
  }, [reloadMessages]);

  const handleStar = useCallback(async (messageId: string) => {
    try {
      await chatService.toggleStarMessage(messageId);
      await reloadMessages();
    } catch (error) {
      console.error('Failed to toggle star:', error);
      toast({
        title: 'Error',
        description: 'Failed to update message',
        variant: 'destructive',
      });
    }
  }, [reloadMessages, toast]);

  const handlePin = useCallback(async (messageId: string) => {
    try {
      await chatService.togglePinMessage(messageId);
      await reloadMessages();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast({
        title: 'Error',
        description: 'Failed to update message',
        variant: 'destructive',
      });
    }
  }, [reloadMessages, toast]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await chatService.addReaction(messageId, emoji);
      await reloadMessages();
    } catch (error) {
      console.error('Failed to add reaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to add reaction',
        variant: 'destructive',
      });
    }
  }, [reloadMessages, toast]);

      // Empty state - no chat selected
      if (!chatId) {
        return (
          <div className="flex h-full flex-col">
            {onBack && (
              <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm p-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>
            )}
            <ChatEmptyState />
          </div>
        );
      }

  // Loading state - skeleton messages
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <ChatHeader
          title={getChatTitle(chat)}
          subtitle={getChatSubtitle(chat)}
          onMenuClick={onMenuClick}
        />
        <div className="flex-1 overflow-hidden px-4 py-6 space-y-5">
          {/* Incoming message skeleton */}
          <div className="flex items-end gap-2 max-w-[75%]">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-emerald-200/50 dark:bg-white/10" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16 bg-emerald-200/30 dark:bg-white/10/50" />
              <Skeleton className="h-16 w-52 rounded-2xl rounded-bl-sm bg-emerald-200/40 dark:bg-white/10" />
              <Skeleton className="h-2.5 w-10 bg-emerald-200/20 dark:bg-white/10/30" />
            </div>
          </div>
          {/* Outgoing message skeleton */}
          <div className="flex items-end gap-2 justify-end max-w-[75%] ml-auto">
            <div className="space-y-1.5 items-end flex flex-col">
              <Skeleton className="h-10 w-44 rounded-2xl rounded-br-sm bg-emerald-300/40 dark:bg-emerald-800/40" />
              <Skeleton className="h-2.5 w-10 bg-emerald-200/20 dark:bg-white/10/30" />
            </div>
          </div>
          {/* Incoming message skeleton */}
          <div className="flex items-end gap-2 max-w-[75%]">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-emerald-200/50 dark:bg-white/10" />
            <div className="space-y-1.5">
              <Skeleton className="h-20 w-64 rounded-2xl rounded-bl-sm bg-emerald-200/40 dark:bg-white/10" />
              <Skeleton className="h-2.5 w-10 bg-emerald-200/20 dark:bg-white/10/30" />
            </div>
          </div>
          {/* Outgoing message skeleton */}
          <div className="flex items-end gap-2 justify-end max-w-[75%] ml-auto">
            <div className="space-y-1.5 items-end flex flex-col">
              <Skeleton className="h-14 w-56 rounded-2xl rounded-br-sm bg-emerald-300/40 dark:bg-emerald-800/40" />
              <Skeleton className="h-2.5 w-10 bg-emerald-200/20 dark:bg-white/10/30" />
            </div>
          </div>
          {/* Incoming message skeleton */}
          <div className="flex items-end gap-2 max-w-[75%]">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-emerald-200/50 dark:bg-white/10" />
            <div className="space-y-1.5">
              <Skeleton className="h-10 w-36 rounded-2xl rounded-bl-sm bg-emerald-200/40 dark:bg-white/10" />
              <Skeleton className="h-2.5 w-10 bg-emerald-200/20 dark:bg-white/10/30" />
            </div>
          </div>
        </div>
        {/* Input area skeleton */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 dark:border-white/6">
          <Skeleton className="h-12 w-full rounded-xl bg-emerald-200/30 dark:bg-white/10/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <ChatHeader
        title={getChatTitle(chat)}
        subtitle={getChatSubtitle(chat)}
        avatar={chat?.avatar || undefined}
        onMenuClick={onMenuClick}
        onBack={onBack}
        showBackButton={true}
        isGroupChat={chat?.isGroupChat || false}
        onGroupMenuClick={() => setShowGroupInfoModal(true)}
        onEdit={handleEditChat}
        onClose={handleCloseChat}
        // Only show leave group option for non-admin members
        onLeaveGroup={chat?.isGroupChat && !isGroupAdmin ? handleLeaveGroup : undefined}
        // Only show delete option for admin/creator
        onDelete={chat?.isGroupChat && isGroupAdmin ? handleDeleteChat : !chat?.isGroupChat ? handleDeleteChat : undefined}
        onUserClick={(userId, userName, userAvatar) => {
          setSelectedUser({ id: userId, name: userName, avatar: userAvatar });
        }}
        otherUserId={chat && !chat.isGroupChat && chat.participants
          ? chat.participants.find(p => p.user && p.user.id !== user?.id)?.user?.id
          : undefined}
        otherUserName={getChatTitle(chat) !== 'Chat' ? getChatTitle(chat) : undefined}
      />

      {/* Messages List */}
      <div className="flex-1 min-h-0 overflow-hidden bg-transparent">
        <ChatMessagesList
          messages={messages}
          currentUserId={user?.id}
          isLoading={false}
          isTyping={typingUsers.size > 0}
          isGroupChat={chat?.isGroupChat || false}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onForward={handleForward}
          onStar={handleStar}
          onPin={handlePin}
          onReaction={handleReaction}
          onViewOnce={handleViewOnce}
          onUserClick={(userId, userName, userAvatar) => {
            setSelectedUser({ id: userId, name: userName, avatar: userAvatar });
          }}
        />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={handleSendMessage}
          isLoading={isSending}
          disabled={isSending || !canSendMessages}
          chatId={chatId || undefined}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          permissionDeniedMessage={permissionDeniedMessage}
        />
      </div>

      {/* Group Info Modal */}
      {chat?.isGroupChat && (
        <GroupInfoModal
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          chat={chat}
          onGroupDeleted={() => {
            setShowGroupInfoModal(false);
            onChatDeleted?.();
            onBack?.();
          }}
          onPermissionsUpdated={() => {
            // Reload chat to get updated permissions
            reloadMessages();
          }}
        />
      )}

      {/* Edit Chat Dialog */}
      <EditChatDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        chat={chat}
        onChatUpdated={handleChatUpdated}
      />

      {/* Forward Message Dialog */}
      {forwardMessageId && (
        <ForwardMessageDialog
          isOpen={showForwardDialog}
          onClose={() => {
            setShowForwardDialog(false);
            setForwardMessageId(null);
          }}
          messageId={forwardMessageId}
          currentChatId={chatId}
          onForwardSuccess={handleForwardSuccess}
        />
      )}

      {/* User Health Profile Modal */}
      {selectedUser && (
        <UserHealthProfileModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          userAvatar={selectedUser.avatar}
        />
      )}

      {/* View Once Viewer */}
      {viewOnceMedia && (
        <ViewOnceViewer
          isOpen={!!viewOnceMedia}
          mediaUrl={viewOnceMedia.mediaUrl}
          mediaThumbnail={viewOnceMedia.mediaThumbnail}
          mediaType={viewOnceMedia.mediaType}
          onClose={handleCloseViewOnce}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chat?.isGroupChat ? 'Delete Group' : 'Delete Chat'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chat?.isGroupChat
                ? 'Are you sure you want to delete this group? This action cannot be undone and all members will be removed.'
                : 'Are you sure you want to delete this chat? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
