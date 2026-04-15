'use client';

import { useState } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageReactionsProps {
  messageId: string;
  reactions?: Array<{ emoji: string; count: number; userIds: string[] }>;
  currentUserId?: string;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, emoji: string) => void;
  className?: string;
}

export function MessageReactions({
  messageId,
  reactions = [],
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  className,
}: MessageReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReactionClick = (emoji: string) => {
    const existingReaction = reactions.find((r) => r.emoji === emoji);
    const hasUserReacted = existingReaction?.userIds.includes(currentUserId || '');

    if (hasUserReacted) {
      onRemoveReaction?.(messageId, emoji);
    } else {
      onAddReaction?.(messageId, emoji);
    }
    setIsOpen(false);
  };

  if (reactions.length === 0) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity', className)}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-lg hover:scale-125 transition-transform"
                onClick={() => handleReactionClick(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {reactions.map((reaction) => {
        const hasUserReacted = reaction.userIds.includes(currentUserId || '');
        return (
          <Button
            key={reaction.emoji}
            variant={hasUserReacted ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              'h-6 px-2 text-xs gap-1',
              hasUserReacted && 'bg-primary/10 border-primary/20'
            )}
            onClick={() => handleReactionClick(reaction.emoji)}
          >
            <span>{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </Button>
        );
      })}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-lg hover:scale-125 transition-transform"
                onClick={() => handleReactionClick(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

