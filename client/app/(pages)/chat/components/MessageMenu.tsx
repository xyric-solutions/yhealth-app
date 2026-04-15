'use client';

import {
  MoreVertical,
  Reply,
  Edit,
  Trash2,
  Forward,
  Star,
  Pin,
  Copy,
  Info,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MessageMenuProps {
  messageId: string;
  isOwn: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
  onStar?: () => void;
  onPin?: () => void;
  onCopy?: () => void;
  onInfo?: () => void;
  className?: string;
}

export function MessageMenu({
  messageId: _messageId,
  isOwn,
  isStarred = false,
  isPinned = false,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onStar,
  onPin,
  onCopy,
  onInfo,
  className,
}: MessageMenuProps) {
  const handleCopy = () => {
    onCopy?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </DropdownMenuItem>
        )}
        {onForward && (
          <DropdownMenuItem onClick={onForward}>
            <Forward className="mr-2 h-4 w-4" />
            Forward
          </DropdownMenuItem>
        )}
        {onCopy && (
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </DropdownMenuItem>
        )}
        {onStar && (
          <DropdownMenuItem onClick={onStar}>
            <Star className={cn('mr-2 h-4 w-4', isStarred && 'fill-current')} />
            {isStarred ? 'Unstar' : 'Star'}
          </DropdownMenuItem>
        )}
        {onPin && (
          <DropdownMenuItem onClick={onPin}>
            <Pin className={cn('mr-2 h-4 w-4', isPinned && 'fill-current')} />
            {isPinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
        )}
        {onInfo && (
          <DropdownMenuItem onClick={onInfo}>
            <Info className="mr-2 h-4 w-4" />
            Info
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {isOwn && onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

