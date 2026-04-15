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
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { chatService, type Chat } from '@/src/shared/services/chat.service';
import { AvatarUploader } from '@/components/common/avatar-uploader';

interface EditChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  onChatUpdated?: () => void;
}

export function EditChatDialog({
  isOpen,
  onClose,
  chat,
  onChatUpdated,
}: EditChatDialogProps) {
  const { toast } = useToast();
  const [chatName, setChatName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarUrlRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (chat) {
      setChatName(chat.chatName || '');
      setAvatarUrl(chat.avatar || null);
      avatarUrlRef.current = chat.avatar || null;
    }
  }, [chat, isOpen]);

  const handleAvatarUpload = async (file: File): Promise<string> => {
    try {
      setIsUploadingAvatar(true);
      const result = await chatService.uploadMedia(file);
      const uploadedUrl = result.url || (result as { mediaUrl?: string }).mediaUrl;
      if (!uploadedUrl) {
        throw new Error('No URL returned from upload');
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chat || !chatName.trim()) {
      toast({
        title: 'Error',
        description: 'Chat name is required',
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

    try {
      setIsLoading(true);
      // Use ref value as fallback to ensure we have the latest uploaded URL
      const currentAvatarUrl = avatarUrl || avatarUrlRef.current;
      // Only send avatar if it's different from the original or if it was just uploaded
      const avatarToSend = currentAvatarUrl !== chat.avatar ? currentAvatarUrl : undefined;
      
      await chatService.renameGroupChat(chat.id, chatName.trim(), avatarToSend);
      toast({
        title: 'Success',
        description: 'Group updated successfully',
      });
      onChatUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to update group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update group';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit {chat?.isGroupChat ? 'Group' : 'Chat'}</DialogTitle>
          <DialogDescription>
            Update the {chat?.isGroupChat ? 'name and avatar' : 'name'} of this {chat?.isGroupChat ? 'group' : 'chat'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Avatar Upload - Only for group chats */}
            {chat?.isGroupChat && (
              <div className="flex flex-col items-center gap-2">
                <Label>Group Avatar</Label>
                <AvatarUploader
                  currentAvatar={avatarUrl}
                  fallback={chatName?.[0]?.toUpperCase() || 'G'}
                  onUpload={handleAvatarUpload}
                  size="lg"
                  disabled={isLoading || isUploadingAvatar}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="chatName">Name</Label>
              <Input
                id="chatName"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="Enter chat name"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isUploadingAvatar || !chatName.trim()}>
              {isLoading || isUploadingAvatar ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploadingAvatar ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

