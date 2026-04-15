'use client';

import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  className?: string;
  markdown?: boolean;
}

export function MessageBubble({
  content,
  isOwn,
  isDeleted = false,
  isEdited = false,
  className,
  markdown = false,
}: MessageBubbleProps) {
  if (!content || !content.trim()) {
    return null;
  }

  if (isDeleted) {
    return (
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5 text-sm',
          'italic text-slate-400 dark:text-slate-500',
          'bg-slate-100 dark:bg-white/8',
          className
        )}
      >
        <span className="flex items-center gap-1.5">
          <span>This message was deleted</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative break-words px-3.5 py-2.5 text-[14px] min-w-fit leading-relaxed',
        isOwn
          ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md shadow-md shadow-emerald-600/20'
          : 'bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md border border-transparent dark:border-white/5',
        className
      )}
    >
      {markdown ? (
        <div className={cn('prose prose-sm max-w-none', isOwn && 'prose-invert')}>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0 text-[14px] leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="mb-1.5 ml-4 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="mb-1.5 ml-4 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="mb-0.5 text-[14px] leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ children }) => (
                <code className={cn(
                  'rounded-md px-1.5 py-0.5 text-xs font-mono',
                  isOwn ? 'bg-white/15' : 'bg-slate-200 dark:bg-white/10'
                )}>
                  {children}
                </code>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="whitespace-pre-wrap min-w-fit text-[14px] leading-relaxed">{content}</p>
      )}
      {isEdited && (
        <span className="text-[11px] opacity-60 ml-1">(edited)</span>
      )}
    </div>
  );
}
