/**
 * Message Adapter
 * Converts chatService.Message to ChatMessageItemData format
 */

import type { Message } from '@/src/shared/services/chat.service';
import type { ChatMessageItemData } from '../components/ChatMessageItem';

/**
 * Convert chatService.Message to ChatMessageItemData
 */
export function adaptMessageToChatMessageItem(
  message: Message,
  currentUserId?: string,
  isAiChat?: boolean
): ChatMessageItemData {
  const isUser = message.senderId === currentUserId;

  // Determine media type from contentType
  let mediaType: 'image' | 'video' | 'audio' | 'document' | 'gif' | undefined;
  if (message.contentType === 'gif') {
    mediaType = 'gif';
  } else if (message.mediaUrl) {
    if (message.contentType === 'image') mediaType = 'image';
    else if (message.contentType === 'video') mediaType = 'video';
    else if (message.contentType === 'audio') mediaType = 'audio';
    else if (message.contentType === 'document' || message.contentType === 'file')
      mediaType = 'document';
  }

  // Only set mediaType if we have mediaUrl to avoid type errors
  const finalMediaType = message.mediaUrl ? mediaType : undefined;

  // Extract file name from mediaUrl if available
  const fileName = message.mediaUrl
    ? message.mediaUrl.split('/').pop()?.split('?')[0]
    : undefined;

  // Extract sender information
  const senderName = message.sender
    ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || message.sender.email
    : undefined;
  const senderAvatar = message.sender?.avatar || null;

  return {
    id: message.id,
    role: isUser ? 'user' : 'assistant',
    senderId: message.senderId,
    senderName,
    senderAvatar,
    content: message.content || '',
    timestamp: message.createdAt,
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,
    contentType: message.contentType,
    mediaUrl: message.mediaUrl || undefined,
    mediaThumbnail: message.mediaThumbnail || undefined,
    mediaType: finalMediaType,
    fileName,
    fileSize: message.mediaSize || undefined,
    repliedTo: message.repliedTo
      ? {
          id: message.repliedTo.id,
          content: message.repliedTo.content || '',
          senderName: message.repliedTo.sender
            ? `${message.repliedTo.sender.firstName || ''} ${message.repliedTo.sender.lastName || ''}`.trim() || message.repliedTo.sender.email
            : undefined,
        }
      : undefined,
    reactions: message.reactions?.map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      userIds: reaction.userIds,
    })),
    isStarred: message.isStarred,
    isPinned: message.isPinned,
    isViewOnce: message.isViewOnce,
    viewOnceOpenedAt: message.viewOnceOpenedAt,
    readBy: message.readBy,
    isAiChat,
  };
}

