'use client';

import { useState } from 'react';
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
import { chatService } from '@/src/shared/services/chat.service';
import { useToast } from '@/hooks/use-toast';
import type { Chat } from '@/src/shared/services/chat.service';

interface JoinGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinSuccess: (chat: Chat) => void;
}

export function JoinGroupDialog({
  isOpen,
  onClose,
  onJoinSuccess,
}: JoinGroupDialogProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (value: string) => {
    // Only allow numeric input and limit to 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setCode(numericValue);
    setError(null);
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setIsJoining(true);
      setError(null);
      const chat = await chatService.joinGroupByCode(code);
      toast({
        title: 'Success',
        description: `Joined ${chat.chatName} successfully`,
      });
      setCode('');
      onClose();
      onJoinSuccess(chat);
    } catch (error) {
      console.error('Failed to join group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join group. Please check the code and try again.';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Group</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code to join a group
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="join-code">Join Code</Label>
            <Input
              id="join-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="text-center text-2xl font-mono tracking-widest h-14"
              maxLength={6}
              disabled={isJoining}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.length === 6 && !isJoining) {
                  handleJoin();
                }
              }}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Ask the group admin for the join code
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isJoining}>
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={isJoining || code.length !== 6}>
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

