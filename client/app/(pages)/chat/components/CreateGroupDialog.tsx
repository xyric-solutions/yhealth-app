'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Share2, Copy } from 'lucide-react';
import { chatService, type Chat } from '@/src/shared/services/chat.service';
import { useToast } from '@/hooks/use-toast';
import { AvatarUploader } from '@/components/common/avatar-uploader';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (chat: Chat) => void;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
}

export function CreateGroupDialog({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupDialogProps) {
  const { toast } = useToast();
  const [chatName, setChatName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarUrlRef = useRef<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdChat, setCreatedChat] = useState<Chat | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setChatName('');
      setAvatarUrl(null);
      avatarUrlRef.current = null;
      setSelectedUserIds([]);
      setCreatedChat(null);
    }
  }, [isOpen]);

  // For now, we'll use a simple approach - users will be selected from existing contacts
  // In a real implementation, you'd fetch users from an API
  const handleAvatarUpload = async (file: File): Promise<string> => {
    try {
      setIsUploadingAvatar(true);
      // Use the chat service uploadMedia method
      const result = await chatService.uploadMedia(file);
      // Handle both response formats: { url } or { mediaUrl }
      const uploadedUrl = result.url || (result as { mediaUrl?: string }).mediaUrl;
      if (!uploadedUrl) {
        throw new Error('No URL returned from upload');
      }
      console.log('Avatar uploaded, URL:', uploadedUrl);
      // Update both state and ref to ensure we always have the latest value
      setAvatarUrl(uploadedUrl);
      avatarUrlRef.current = uploadedUrl;
      return uploadedUrl;
    } catch (error: unknown) {
      console.error('Failed to upload avatar:', error);
      // Extract error message from ApiError or axios response
      const err = error as { message?: string; code?: string; response?: { data?: { message?: string; code?: string; error?: { message?: string; code?: string } } } };
      const errorMessage =
        err?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        'Failed to upload avatar';
      const errorCode =
        err?.code ||
        err?.response?.data?.code ||
        err?.response?.data?.error?.code;

      toast({
        title: errorCode === 'FILE_TOO_LARGE' ? 'File Too Large' : 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!chatName.trim()) {
      toast({
        title: 'Error',
        description: 'Group name is required',
        variant: 'destructive',
      });
      return;
    }

    // Wait for avatar upload to complete if it's in progress
    if (isUploadingAvatar) {
      toast({
        title: 'Please wait',
        description: 'Avatar upload is in progress. Please wait for it to complete.',
        variant: 'default',
      });
      return;
    }

    // Allow creating group with 0 users - users can join by code later

    try {
      setIsCreating(true);
      // Use ref value as fallback to ensure we have the latest uploaded URL
      const currentAvatarUrl = avatarUrl || avatarUrlRef.current;
      
      // Backend requires avatar, so we must provide one
      if (!currentAvatarUrl) {
        toast({
          title: 'Error',
          description: 'Please upload a group avatar before creating the group',
          variant: 'destructive',
        });
        setIsCreating(false);
        return;
      }
      
      const payload = {
        chatName: chatName.trim(),
        users: selectedUserIds, // Can be empty - creator will be automatically added as participant
        avatar: currentAvatarUrl, // Always include avatar as backend requires it
      };
      
      console.log('Creating group with payload:', payload);
      console.log('Avatar URL state:', avatarUrl, 'Avatar URL ref:', avatarUrlRef.current);
      const chat = await chatService.createGroupChat(payload);
      console.log('Group created, response:', chat);
      console.log('Join code:', chat.joinCode);
      setCreatedChat(chat);
      toast({
        title: 'Success',
        description: 'Group created successfully',
      });
      // Don't call onGroupCreated immediately - wait for user to close the dialog
      // onGroupCreated?.(chat);
    } catch (error) {
      console.error('Failed to create group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdChat) return;
    
    // Handle both camelCase and snake_case (in case transformation hasn't happened)
    const joinCode = createdChat.joinCode || (createdChat as { join_code?: string }).join_code;
    if (joinCode) {
      try {
        await navigator.clipboard.writeText(joinCode);
        toast({
          title: 'Copied',
          description: 'Join code copied to clipboard',
        });
      } catch (error) {
        console.error('Failed to copy code:', error);
        toast({
          title: 'Error',
          description: 'Failed to copy code to clipboard',
          variant: 'destructive',
        });
      }
    } else {
      console.error('No join code available in chat:', createdChat);
      toast({
        title: 'Error',
        description: 'No join code available',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!createdChat) return;
    
    // Handle both camelCase and snake_case (in case transformation hasn't happened)
    const joinCode = createdChat.joinCode || (createdChat as { join_code?: string }).join_code;
    if (joinCode) {
      const shareData = {
        title: `Join ${createdChat.chatName}`,
        text: `Join my group "${createdChat.chatName}" using code: ${joinCode}`,
        url: window.location.href,
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(
            `Join my group "${createdChat.chatName}" using code: ${joinCode}`
          );
          toast({
            title: 'Copied',
            description: 'Share text copied to clipboard',
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast({
            title: 'Error',
            description: 'Failed to share',
            variant: 'destructive',
          });
        }
      }
    } else {
      toast({
        title: 'Error',
        description: 'No join code available to share',
        variant: 'destructive',
      });
    }
  };

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds([...selectedUserIds, userId]);
    } else {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    }
  };

  // For demo purposes, we'll show a placeholder for user selection
  // In production, you'd fetch users from an API
  const availableUsers: User[] = []; 

  const getInitials = (firstName?: string, lastName?: string): string => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    return '?';
  };

  // If group is created, show success screen with join code
  if (createdChat) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Group Created!</DialogTitle>
            <DialogDescription>
              Share this code with others to join your group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Join Code</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 border rounded-lg bg-muted/50">
                  <span className="text-2xl font-mono font-bold tracking-wider">
                    {createdChat.joinCode || (createdChat as { join_code?: string }).join_code || '------'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  title="Copy code"
                  disabled={!createdChat.joinCode && !(createdChat as { join_code?: string }).join_code}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This code expires in 24 hours
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              onClick={() => {
                onGroupCreated?.(createdChat);
                onClose();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Group Chat</DialogTitle>
          <DialogDescription>
            Create a new group chat with multiple members
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 py-4">
            {/* Group Name */}
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="Enter group name"
                disabled={isCreating}
                autoFocus
              />
            </div>

            {/* Group Avatar */}
            <div className="space-y-2">
              <Label>Group Avatar</Label>
              <div className="flex justify-center">
                <AvatarUploader
                  currentAvatar={avatarUrl}
                  fallback={chatName?.[0]?.toUpperCase() || 'G'}
                  onUpload={handleAvatarUpload}
                  size="lg"
                  disabled={isCreating || isUploadingAvatar}
                />
              </div>
            </div>

            {/* Member Selection */}
            <div className="space-y-2">
              <Label>Select Members ({selectedUserIds.length} selected)</Label>
              <div className="border rounded-lg p-4 bg-muted/30 min-h-[200px] max-h-[300px] overflow-y-auto">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">User selection coming soon</p>
                    <p className="text-xs mt-1">
                      For now, members can be added after group creation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={(checked) =>
                            handleUserToggle(user.id, checked as boolean)
                          }
                          disabled={isCreating}
                        />
                        <label
                          htmlFor={`user-${user.id}`}
                          className="flex-1 flex items-center gap-3 cursor-pointer"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar || undefined} alt={user.firstName} />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                              {getInitials(user.firstName, user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Users can join the group using the join code after creation
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateGroup}
            disabled={isCreating || !chatName.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

