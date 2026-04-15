'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Check, MessageSquare, Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/app/context/AuthContext';
import { chatService, type Chat } from '@/src/shared/services/chat.service';
import { cn } from '@/lib/utils';

interface ForwardMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  currentChatId: string | null;
  onForwardSuccess?: () => void;
}

export function ForwardMessageDialog({
  isOpen,
  onClose,
  messageId,
  currentChatId,
  onForwardSuccess,
}: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadChats();
      setSelectedChatIds(new Set());
      setSearchQuery('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = chats.filter((chat) => {
        const title = getChatTitle(chat).toLowerCase();
        return title.includes(query);
      });
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, chats]);

  const loadChats = async () => {
    try {
      setIsLoading(true);
      const data = await chatService.getChats({ limit: 100 });
      // Filter out:
      // 1. The current chat
      // 2. Chats where the user is not a participant
      // 3. Chats where the user has left (leftAt is not null)
      const availableChats = data.filter((chat) => {
        // Exclude current chat
        if (chat.id === currentChatId) {
          return false;
        }

        // Check if user is a participant
        if (!chat.participants || chat.participants.length === 0) {
          return false;
        }

        // Find user's participation
        const userParticipant = chat.participants.find(
          (p) => p.userId === user?.id
        );

        // Exclude if user is not a participant or has left
        if (!userParticipant || userParticipant.leftAt !== null) {
          return false;
        }

        return true;
      });
      setChats(availableChats);
      setFilteredChats(availableChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chats',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getChatTitle = (chat: Chat): string => {
    if (chat.isGroupChat) {
      return chat.chatName || 'Group Chat';
    }

    // For one-on-one chats, find the other participant
    if (chat.participants && user) {
      const otherParticipant = chat.participants.find(
        (p) => p.user && p.user.id !== user.id
      );
      if (otherParticipant?.user) {
        const { firstName, lastName } = otherParticipant.user;
        return `${firstName} ${lastName}`.trim() || otherParticipant.user.email;
      }
    }

    return 'Chat';
  };

  const getChatAvatar = (chat: Chat): string | null => {
    if (chat.avatar) return chat.avatar;

    if (chat.isGroupChat) return null;

    if (chat.participants && user) {
      const otherParticipant = chat.participants.find(
        (p) => p.user && p.user.id !== user.id
      );
      if (otherParticipant?.user?.avatar) {
        return otherParticipant.user.avatar;
      }
    }

    return null;
  };

  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  const handleForward = async () => {
    if (selectedChatIds.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one chat to forward to',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsForwarding(true);
      await chatService.forwardMessage(messageId, Array.from(selectedChatIds));
      toast({
        title: 'Success',
        description: `Message forwarded to ${selectedChatIds.size} ${selectedChatIds.size === 1 ? 'chat' : 'chats'}`,
      });
      onForwardSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to forward message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to forward message';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Forward Message</DialogTitle>
          <DialogDescription>
            Select one or more chats to forward this message to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Chat List */}
          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No chats found' : 'No chats available'}
                </p>
              </div>
            ) : (
              <div className="p-2">
                {filteredChats.map((chat) => {
                  const isSelected = selectedChatIds.has(chat.id);
                  const title = getChatTitle(chat);
                  const avatar = getChatAvatar(chat);

                  return (
                    <button
                      key={chat.id}
                      onClick={() => toggleChatSelection(chat.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                        'hover:bg-muted/50',
                        isSelected && 'bg-muted'
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={avatar || undefined} alt={title} />
                          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                            {chat.isGroupChat ? (
                              <Users className="h-5 w-5" />
                            ) : (
                              <span className="text-sm">
                                {title
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            )}
                          </AvatarFallback>
                        </Avatar>
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{title}</p>
                        {chat.isGroupChat && (
                          <p className="text-xs text-muted-foreground">
                            {chat.participants?.length || 0} members
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {selectedChatIds.size > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {selectedChatIds.size} {selectedChatIds.size === 1 ? 'chat' : 'chats'} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isForwarding}>
            Cancel
          </Button>
          <Button onClick={handleForward} disabled={isForwarding || selectedChatIds.size === 0}>
            {isForwarding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Forwarding...
              </>
            ) : (
              <>
                Forward to {selectedChatIds.size > 0 && `${selectedChatIds.size} `}
                {selectedChatIds.size === 1 ? 'chat' : 'chats'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

