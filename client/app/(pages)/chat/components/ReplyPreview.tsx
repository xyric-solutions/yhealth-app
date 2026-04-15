'use client';

import { X, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReplyPreviewProps {
  message: {
    content: string;
    senderName?: string;
    mediaType?: string;
  };
  onCancel: () => void;
  className?: string;
}

export function ReplyPreview({ message, onCancel, className }: ReplyPreviewProps) {
  const previewText =
    message.mediaType === 'image'
      ? '📷 Photo'
      : message.mediaType === 'video'
      ? '🎥 Video'
      : message.mediaType === 'audio'
      ? '🎤 Audio'
      : message.mediaType === 'document'
      ? '📄 Document'
      : message.content?.substring(0, 50) || '';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border-l-2 border-emerald-500',
        className
      )}
    >
      <Reply className="h-3.5 w-3.5 text-emerald-500 shrink-0 -scale-x-100" />
      <div className="flex-1 min-w-0">
        {message.senderName && (
          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {message.senderName}
          </div>
        )}
        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
          {previewText}
          {!message.mediaType && message.content && message.content.length > 50 ? '...' : ''}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onClick={onCancel}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
