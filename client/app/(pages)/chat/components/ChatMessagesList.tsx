'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessageItem, type ChatMessageItemData } from './ChatMessageItem';
import { TypingIndicator } from '@/components/chat';
import { DateSeparator } from './DateSeparator';
import { cn } from '@/lib/utils';
import { isSameDay } from 'date-fns';

interface ChatMessagesListProps {
  messages: ChatMessageItemData[];
  currentUserId?: string;
  isLoading?: boolean;
  isTyping?: boolean;
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
  className?: string;
}

export function ChatMessagesList({
  messages,
  currentUserId,
  isLoading = false,
  isTyping = false,
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
  className,
}: ChatMessagesListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Group messages by date and insert date separators
  const messagesWithSeparators = useMemo(() => {
    if (messages.length === 0) return [];

    const result: Array<{ type: 'message' | 'separator'; data: ChatMessageItemData | Date }> = [];
    let lastDate: Date | null = null;

    for (const message of messages) {
      if (!message.timestamp) {
        // If no timestamp, just add the message
        result.push({ type: 'message', data: message });
        continue;
      }

      const messageDate = new Date(message.timestamp);

      // Check if we need to add a date separator
      // Compare only the date part (year, month, day), ignoring time
      if (!lastDate || !isSameDay(messageDate, lastDate)) {
        result.push({ type: 'separator', data: messageDate });
        lastDate = messageDate;
      }

      result.push({ type: 'message', data: message });
    }

    return result;
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  return (
    <ScrollArea ref={scrollRef} className={cn('flex-1 h-full bg-slate-50/30 dark:bg-transparent', className)}>
      <div className="w-full py-3">
        {messagesWithSeparators.map((item) => {
          if (item.type === 'separator') {
            const separatorDate = item.data as Date;
            return (
              <DateSeparator
                key={`separator-${separatorDate.getTime()}`}
                date={separatorDate}
              />
            );
          }

          const message = item.data as ChatMessageItemData;
          return (
            <ChatMessageItem
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              isLoading={isLoading && message.id === messages[messages.length - 1]?.id}
              isGroupChat={isGroupChat}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onForward={onForward}
              onStar={onStar}
              onPin={onPin}
              onReaction={onReaction}
              onUserClick={onUserClick}
              onViewOnce={onViewOnce}
            />
          );
        })}
        {isTyping && (
          <div className="px-4">
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

