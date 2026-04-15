'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageBubble, MessageStatus, MessageMedia } from '@/components/chat';
import { AudioPlayer } from './AudioPlayer';
import { MessageMenu } from './MessageMenu';
import { MessageReactions } from './MessageReactions';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export interface ChatMessageItemData {
  id: string;
  role: 'user' | 'assistant';
  senderId?: string;
  senderName?: string;
  senderAvatar?: string | null;
  content: string;
  timestamp?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  contentType?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'gif';
  fileName?: string;
  fileSize?: number;
  repliedTo?: {
    id: string;
    content: string;
    senderName?: string;
  };
  reactions?: Array<{ emoji: string; count: number; userIds: string[] }>;
  isStarred?: boolean;
  isPinned?: boolean;
  isViewOnce?: boolean;
  viewOnceOpenedAt?: string | null;
  readBy?: string[];
  /** For AI coach chats — sent messages always show as read */
  isAiChat?: boolean;
}

interface ChatMessageItemProps {
  message: ChatMessageItemData;
  currentUserId?: string;
  isLoading?: boolean;
  isGroupChat?: boolean;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onUserClick?: (userId: string, userName: string, userAvatar?: string | null) => void;
  onViewOnce?: (messageId: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  currentUserId,
  isLoading = false,
  isGroupChat = false,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onStar,
  onPin,
  onReaction,
  onUserClick,
  onViewOnce,
}: ChatMessageItemProps) {
  const isUser = message.senderId === currentUserId;
  const isViewOnce = message.isViewOnce;
  const viewOnceOpened = isViewOnce && !!message.viewOnceOpenedAt;
  const showMedia = !isViewOnce
    ? (message.mediaUrl && message.mediaType !== 'audio' && message.contentType !== 'gif')
    : false;
  const showAudio = !isViewOnce
    ? (message.mediaUrl && message.mediaType === 'audio')
    : false;
  const hasTextContent = message.content && message.content.trim().length > 0;
  const isSystemMessage = message.contentType === 'system';

  const viewOnceLabel = message.mediaType === 'video' ? 'video'
    : message.mediaType === 'audio' ? 'audio'
    : 'photo';

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || '?';
  };

  const handleCopy = () => {
    if (message.content && !message.isDeleted) {
      navigator.clipboard.writeText(message.content);
    }
  };

  if (isSystemMessage) {
    return (
      <div className="flex items-center justify-center px-4 py-2.5">
        <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/8 px-3 py-1 rounded-full font-medium">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex gap-2.5 px-4 sm:px-6 py-1 transition-colors',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <button
          onClick={() => {
            if (onUserClick && message.senderId && message.senderName) {
              onUserClick(message.senderId, message.senderName, message.senderAvatar);
            }
          }}
          className="cursor-pointer hover:opacity-80 transition-opacity self-end mb-5"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={message.senderAvatar || undefined} alt={message.senderName || 'User'} />
            <AvatarFallback className="bg-linear-to-br from-emerald-600 to-sky-600 text-white text-xs font-semibold">
              {getInitials(message.senderName || '')}
            </AvatarFallback>
          </Avatar>
        </button>
      )}

      {/* Message content */}
      <div
        className={cn('flex flex-col gap-0.5 max-w-[75%] sm:max-w-[65%]', isUser ? 'items-end' : 'items-start')}
      >
        {/* Sender name for group chats */}
        {isGroupChat && !isUser && message.senderName && (
          <button
            onClick={() => {
              if (onUserClick && message.senderId && message.senderName) {
                onUserClick(message.senderId, message.senderName, message.senderAvatar);
              }
            }}
            className="text-[12px] text-emerald-600 dark:text-emerald-400 px-1 pb-0.5 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer font-semibold"
          >
            {message.senderName}
          </button>
        )}

        {/* Reply context */}
        {message.repliedTo && (
          <div
            className={cn(
              'text-xs text-slate-500 dark:text-slate-400 mb-0.5 px-3 py-1.5 rounded-xl',
              isUser
                ? 'bg-emerald-500/10 border-r-2 border-emerald-500'
                : 'bg-slate-100 dark:bg-white/8 border-l-2 border-slate-300 dark:border-white/20'
            )}
          >
            {message.repliedTo.senderName && (
              <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">{message.repliedTo.senderName}</div>
            )}
            <div className="truncate">{message.repliedTo.content}</div>
          </div>
        )}

        <div className={cn('flex items-end gap-1.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <div className={cn('flex flex-col gap-0.5', isUser ? 'items-end' : 'items-start')}>
            {/* View-once message card */}
            {isViewOnce && (
              viewOnceOpened ? (
                <div className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-2xl',
                  isUser
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/8'
                )}>
                  <Eye className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500 dark:text-slate-400 italic">
                    {isUser ? `View once ${viewOnceLabel} \u2022 Opened` : `Opened`}
                  </span>
                </div>
              ) : isUser ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <EyeOff className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    View once {viewOnceLabel} &bull; Waiting...
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => onViewOnce?.(message.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all',
                    'bg-slate-50 dark:bg-white/5',
                    'border border-slate-200 dark:border-white/8',
                    'hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/5',
                    'active:scale-[0.98]'
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Lock className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      View once {viewOnceLabel}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Tap to open
                    </p>
                  </div>
                </button>
              )
            )}

            {/* GIF */}
            {message.contentType === 'gif' && message.mediaUrl && (
              <div className={cn('rounded-2xl overflow-hidden', hasTextContent ? 'mb-1' : '')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.mediaUrl}
                  alt="GIF"
                  className="max-w-[300px] w-full h-auto rounded-2xl"
                  loading="lazy"
                />
              </div>
            )}

            {/* Media */}
            {showMedia && message.mediaType && message.mediaUrl && (
              <MessageMedia
                mediaUrl={message.mediaUrl}
                mediaThumbnail={message.mediaThumbnail}
                mediaType={message.mediaType as 'image' | 'video' | 'audio' | 'document'}
                fileName={message.fileName}
                fileSize={message.fileSize}
                isOwn={isUser}
                className={hasTextContent ? "mb-1" : ""}
              />
            )}

            {/* Audio */}
            {showAudio && (
              <div className={hasTextContent ? "mb-1" : ""}>
                <AudioPlayer src={message.mediaUrl!} isOwn={isUser} />
              </div>
            )}

            {/* Message bubble */}
            {hasTextContent && (
              <MessageBubble
                content={message.content}
                isOwn={isUser}
                isDeleted={message.isDeleted}
                isEdited={message.isEdited}
                markdown={!isUser}
              />
            )}

            {/* Timestamp and status */}
            <div
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium',
                hasTextContent ? 'px-1 mt-0.5' : (showMedia || showAudio) ? 'px-1 mt-1' : 'px-1 mt-0.5',
                isUser ? 'flex-row-reverse text-slate-400 dark:text-slate-500' : 'flex-row text-slate-400 dark:text-slate-500'
              )}
            >
              {message.timestamp && (() => {
                try {
                  let timestampStr = message.timestamp;
                  if (!timestampStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(timestampStr)) {
                    timestampStr = timestampStr + 'Z';
                  }
                  const date = new Date(timestampStr);
                  if (isNaN(date.getTime())) {
                    return null;
                  }
                  return <span>{format(date, 'h:mm a')}</span>;
                } catch {
                  return null;
                }
              })()}
              {isUser && (
                <MessageStatus status={
                  isLoading ? 'sending'
                    : message.isAiChat ? 'read'
                    : message.readBy && message.readBy.length > 0 ? 'read'
                    : 'delivered'
                } />
              )}
            </div>

            {/* Reactions */}
            <div className={cn('flex items-center gap-1 mt-0.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
              <MessageReactions
                messageId={message.id}
                reactions={message.reactions || []}
                currentUserId={currentUserId}
                onAddReaction={onReaction}
                onRemoveReaction={onReaction}
              />
            </div>
          </div>

          {/* Message menu */}
          {!message.isDeleted && (
            <MessageMenu
              messageId={message.id}
              isOwn={isUser}
              isStarred={message.isStarred}
              isPinned={message.isPinned}
              onReply={() => onReply?.(message.id)}
              onEdit={isUser ? () => onEdit?.(message.id) : undefined}
              onDelete={() => onDelete?.(message.id)}
              onForward={() => onForward?.(message.id)}
              onStar={() => onStar?.(message.id)}
              onPin={() => onPin?.(message.id)}
              onCopy={handleCopy}
            />
          )}
        </div>
      </div>
    </div>
  );
});
