'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquarePlus,
  Search,
  MoreVertical,
  Trash2,
  Archive,
  MessagesSquare,
  Pin,
  CheckCheck,
  Star,
  Copy,
  Bot,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { isToday, isYesterday, isThisWeek, isThisMonth, formatDistanceToNow } from 'date-fns';
import type { RAGConversation } from '@/src/shared/services/rag-chat.service';

interface ConversationSidebarProps {
  conversations: RAGConversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onSearch: (query: string) => void;
  onPin?: (id: string) => void;
  onStar?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  isLoading?: boolean;
}

function groupConversations(conversations: RAGConversation[]) {
  const groups: Record<string, RAGConversation[]> = {};

  conversations.forEach((conv) => {
    const date = new Date(conv.lastMessageAt || conv.createdAt);
    let group: string;

    if (isToday(date)) {
      group = 'Today';
    } else if (isYesterday(date)) {
      group = 'Yesterday';
    } else if (isThisWeek(date)) {
      group = 'This Week';
    } else if (isThisMonth(date)) {
      group = 'This Month';
    } else {
      group = 'Older';
    }

    if (!groups[group]) groups[group] = [];
    groups[group].push(conv);
  });

  return groups;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onArchive,
  onSearch,
  onPin,
  onStar,
  onMarkAsRead,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  const groupedConversations = groupConversations(conversations);
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  return (
    <div className="flex h-full w-72 flex-col bg-zinc-950/50 backdrop-blur-xl border-r border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-white">Conversations</span>
        </div>
        <Button
          onClick={onNew}
          size="sm"
          className="h-8 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5">
        <div className={cn(
          "relative flex items-center rounded-xl transition-all duration-200",
          "bg-white/[0.04] border",
          searchFocused ? "border-emerald-500/30 bg-white/[0.06]" : "border-white/[0.06]"
        )}>
          <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-500" />
          <input
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search conversations..."
            className="w-full bg-transparent pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); onSearch(''); }}
              className="absolute right-2 p-1 rounded-md hover:bg-white/10 text-zinc-500"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <MessagesSquare className="h-7 w-7 text-zinc-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">No conversations yet</p>
              <p className="text-xs text-zinc-600 mt-1">Start chatting with Aurea</p>
            </div>
          </div>
        ) : (
          <div className="px-2 pb-4">
            {groupOrder.map((group) => {
              const convs = groupedConversations[group];
              if (!convs?.length) return null;

              return (
                <div key={group} className="mt-3 first:mt-1">
                  <p className="px-2 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {convs.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === activeId}
                        onClick={() => onSelect(conv.id)}
                        onDelete={() => onDelete(conv.id)}
                        onArchive={() => onArchive(conv.id)}
                        onPin={onPin ? () => onPin(conv.id) : undefined}
                        onStar={onStar ? () => onStar(conv.id) : undefined}
                        onMarkAsRead={onMarkAsRead ? () => onMarkAsRead(conv.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Conversation Item ──────────────────────────────────────────────

interface ConversationItemProps {
  conversation: RAGConversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onPin?: () => void;
  onStar?: () => void;
  onMarkAsRead?: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
  onArchive,
  onPin,
  onStar,
  onMarkAsRead,
}: ConversationItemProps) {
  const timeAgo = conversation.lastMessageAt
    ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
    : '';

  const displayTitle = conversation.title || conversation.lastMessagePreview || (conversation.messageCount > 0 ? `Chat (${conversation.messageCount})` : 'New Chat');
  const preview = conversation.lastMessagePreview || `${conversation.messageCount} messages`;
  const isAssistant = conversation.lastMessageRole === 'assistant';

  return (
    <motion.div
      whileHover={{ x: 2 }}
      className={cn(
        'group relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 cursor-pointer',
        isActive
          ? 'bg-emerald-500/10 border border-emerald-500/15'
          : 'border border-transparent hover:bg-white/[0.04] hover:border-white/[0.04]'
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
        isActive ? "bg-emerald-500/20" : "bg-white/[0.05]"
      )}>
        <Bot className={cn("h-4 w-4", isActive ? "text-emerald-400" : "text-zinc-500")} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            "truncate text-[13px] font-medium leading-tight",
            isActive ? "text-emerald-300" : "text-zinc-200"
          )}>
            {displayTitle}
          </p>
          {timeAgo && (
            <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
              {timeAgo}
            </span>
          )}
        </div>

        {/* Last message preview */}
        <p className="truncate text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
          {isAssistant && <span className="text-emerald-500/70">Aurea: </span>}
          {!isAssistant && conversation.lastMessagePreview && <span className="text-zinc-400">You: </span>}
          {preview}
        </p>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 text-zinc-500 hover:text-white hover:bg-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onMarkAsRead && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkAsRead(); }}>
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Mark as Read
            </DropdownMenuItem>
          )}
          {onPin && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin(); }}>
              <Pin className="mr-2 h-3.5 w-3.5" />
              Pin
            </DropdownMenuItem>
          )}
          {onStar && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStar(); }}>
              <Star className="mr-2 h-3.5 w-3.5" />
              Star
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            if (conversation.title) navigator.clipboard.writeText(conversation.title);
          }}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy Title
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-400 focus:text-red-400"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}

export default ConversationSidebar;
