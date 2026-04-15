'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isLoading?: boolean;
}

export function ChatMessage({ role, content, timestamp, isLoading }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
            </div>
          ) : (
            <div className={cn('prose prose-sm max-w-none', isUser && 'prose-invert')}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  code: ({ children }) => (
                    <code className="rounded bg-black/10 px-1 py-0.5 text-sm dark:bg-white/10">
                      {children}
                    </code>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (() => {
          try {
            // If timestamp doesn't have timezone info, treat it as UTC
            let timestampStr = timestamp;
            
            // If timestamp doesn't end with 'Z' or timezone offset, append 'Z' to treat as UTC
            if (!timestampStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(timestampStr)) {
              timestampStr = timestampStr + 'Z';
            }
            
            const date = new Date(timestampStr);
            
            // Validate the date
            if (isNaN(date.getTime())) {
              return null;
            }
            
            return (
              <span className="text-xs text-muted-foreground px-2">
                {format(date, 'h:mm a')}
              </span>
            );
          } catch (error) {
            console.error('Error formatting timestamp:', error);
            return null;
          }
        })()}
      </div>
    </div>
  );
}

export default ChatMessage;
