'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, RefreshCw, Trash2, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chatService, type Chat, type GroupMember } from '@/src/shared/services/chat.service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/app/context/AuthContext';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  onGroupDeleted?: () => void;
  onPermissionsUpdated?: () => void;
}

export function GroupInfoModal({
  isOpen,
  onClose,
  chat,
  onGroupDeleted,
  onPermissionsUpdated,
}: GroupInfoModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'all' | 'restricted'>('all');
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);

  const isAdmin = chat?.groupAdmin === user?.id;
  const isCreator = chat?.createdBy === user?.id;
  const canManage = isAdmin || isCreator;

  // Load members when modal opens
  useEffect(() => {
    if (isOpen && chat?.id) {
      loadMembers();
      if (chat.messagePermissionMode) {
        setPermissionMode(chat.messagePermissionMode);
      }
      if (chat.allowedSenderIds) {
        setAllowedUserIds(chat.allowedSenderIds);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chat?.id]);

  const loadMembers = async () => {
    if (!chat?.id) return;
    try {
      setIsLoading(true);
      const membersList = await chatService.getGroupMembers(chat.id);
      setMembers(membersList);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load group members',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (chat?.joinCode) {
      navigator.clipboard.writeText(chat.joinCode);
      toast({
        title: 'Copied',
        description: 'Join code copied to clipboard',
      });
    }
  };

  const handleRegenerateCode = async () => {
    if (!chat?.id) return;
    try {
      setIsRegenerating(true);
      await chatService.regenerateJoinCode(chat.id);
      toast({
        title: 'Success',
        description: 'Join code regenerated successfully',
      });
      // Refresh chat data would be handled by parent
      onClose();
    } catch (error: unknown) {
      console.error('Failed to regenerate code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate join code';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!chat?.id) return;
    try {
      setIsDeleting(true);
      await chatService.deleteGroup(chat.id);
      toast({
        title: 'Success',
        description: 'Group deleted successfully',
      });
      setShowDeleteConfirm(false);
      onClose();
      onGroupDeleted?.();
    } catch (error: unknown) {
      console.error('Failed to delete group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete group';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePermissionModeChange = async (mode: 'all' | 'restricted') => {
    if (!chat?.id || !isAdmin) return;
    setPermissionMode(mode);
    
    if (mode === 'all') {
      // Save immediately when switching to 'all'
      try {
        setIsUpdatingPermissions(true);
        await chatService.updateMessagePermissions(chat.id, 'all');
        toast({
          title: 'Success',
          description: 'Message permissions updated',
        });
        onPermissionsUpdated?.();
      } catch (error: unknown) {
        console.error('Failed to update permissions:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update permissions';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setPermissionMode(chat.messagePermissionMode || 'all');
      } finally {
        setIsUpdatingPermissions(false);
      }
    } else if (mode === 'restricted') {
      // When switching to restricted, initialize with admin and creator as allowed
      const adminAndCreatorIds = [
        ...(chat.groupAdmin ? [chat.groupAdmin] : []),
        ...(chat.createdBy && chat.createdBy !== chat.groupAdmin ? [chat.createdBy] : []),
      ];
      const initialAllowedIds = [...new Set([...allowedUserIds, ...adminAndCreatorIds])];
      
      try {
        setIsUpdatingPermissions(true);
        await chatService.updateMessagePermissions(chat.id, 'restricted', initialAllowedIds);
        setAllowedUserIds(initialAllowedIds);
        toast({
          title: 'Success',
          description: 'Message permissions updated',
        });
        onPermissionsUpdated?.();
      } catch (error: unknown) {
        console.error('Failed to update permissions:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update permissions';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setPermissionMode(chat.messagePermissionMode || 'all');
      } finally {
        setIsUpdatingPermissions(false);
      }
    }
  };

  const handleAllowedUserToggle = async (userId: string, checked: boolean) => {
    if (!chat?.id || !isAdmin) return;
    
    const newAllowedIds = checked
      ? [...allowedUserIds, userId]
      : allowedUserIds.filter(id => id !== userId);
    
    setAllowedUserIds(newAllowedIds);
    
    try {
      setIsUpdatingPermissions(true);
      await chatService.updateMessagePermissions(chat.id, 'restricted', newAllowedIds);
      toast({
        title: 'Success',
        description: 'Message permissions updated',
      });
      onPermissionsUpdated?.();
    } catch (error: unknown) {
      console.error('Failed to update permissions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update permissions';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setAllowedUserIds(chat.allowedSenderIds || []);
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string): string => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    return '?';
  };

  const isCodeExpired = chat?.joinCodeExpiresAt
    ? new Date(chat.joinCodeExpiresAt) < new Date()
    : false;

  if (!chat) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Group Info</DialogTitle>
            <DialogDescription>
              Manage group settings, members, and permissions
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6">
              {/* Group Info Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Group Information</h3>
                <div className="flex items-center gap-4">
                  {chat.avatar && (
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={chat.avatar} alt={chat.chatName} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-lg">
                        {chat.chatName?.[0]?.toUpperCase() || 'G'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1">
                    <p className="text-lg font-medium">{chat.chatName}</p>
                    <p className="text-sm text-muted-foreground">
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                </div>

                {/* Join Code */}
                <div className="space-y-2">
                  <Label>Join Code</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-4 py-2 border rounded-lg bg-muted/50">
                      <span className={cn(
                        "text-2xl font-mono font-bold tracking-wider",
                        isCodeExpired && "text-muted-foreground line-through"
                      )}>
                        {chat.joinCode || '------'}
                      </span>
                      {isCodeExpired && (
                        <span className="text-xs text-destructive">(Expired)</span>
                      )}
                    </div>
                    {chat.joinCode && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyCode}
                          title="Copy code"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRegenerateCode}
                            disabled={isRegenerating}
                            title="Regenerate code"
                          >
                            <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {chat.joinCodeExpiresAt && !isCodeExpired && (
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(chat.joinCodeExpiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Members Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members ({members.length})
                  </h3>
                </div>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading members...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const isMemberAdmin = chat.groupAdmin === member.userId;
                      const isMemberCreator = chat.createdBy === member.userId;
                      const isChecked = isMemberAdmin || isMemberCreator || allowedUserIds.includes(member.userId);
                      const isDisabled = isMemberAdmin || isMemberCreator || !isAdmin || permissionMode !== 'restricted';
                      
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.user.avatar || undefined} alt={member.user.firstName} />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                              {getInitials(member.user.firstName, member.user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">
                                {member.user.firstName} {member.user.lastName}
                              </p>
                              {isMemberAdmin && (
                                <Shield className="h-4 w-4 text-primary" />
                              )}
                              {isMemberCreator && (
                                <span className="text-xs text-muted-foreground">(Creator)</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.user.email}
                            </p>
                          </div>
                          {isAdmin && permissionMode === 'restricted' && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`member-switch-${member.id}`} className="text-xs text-muted-foreground">
                                Allow
                              </Label>
                              <Switch
                                id={`member-switch-${member.id}`}
                                checked={isChecked}
                                disabled={isDisabled || isUpdatingPermissions}
                                onCheckedChange={(checked) =>
                                  handleAllowedUserToggle(member.userId, checked)
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Message Permissions Section */}
              {isAdmin && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Message Permissions</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="permission-mode">Who can send messages</Label>
                        <p className="text-sm text-muted-foreground">
                          Control who can send messages in this group
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="permission-all" className="text-sm font-normal">
                          All
                        </Label>
                        <Switch
                          id="permission-mode"
                          checked={permissionMode === 'restricted'}
                          onCheckedChange={(checked) =>
                            handlePermissionModeChange(checked ? 'restricted' : 'all')
                          }
                          disabled={isUpdatingPermissions}
                        />
                        <Label htmlFor="permission-restricted" className="text-sm font-normal">
                          Restricted
                        </Label>
                      </div>
                    </div>

                    {permissionMode === 'restricted' && (
                      <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                        <Label className="text-sm font-medium">Allowed Senders</Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Select members who can send messages
                        </p>
                        {isLoading ? (
                          <div className="text-center py-4 text-muted-foreground">
                            Loading members...
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {members.map((member) => {
                              const isMemberAdmin = chat.groupAdmin === member.userId;
                              const isMemberCreator = chat.createdBy === member.userId;
                              // Admin and creator are always allowed
                              const isChecked = isMemberAdmin || isMemberCreator || allowedUserIds.includes(member.userId);
                              const isDisabled = isMemberAdmin || isMemberCreator;

                              return (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`allowed-${member.id}`}
                                    checked={isChecked}
                                    disabled={isDisabled || isUpdatingPermissions}
                                    onCheckedChange={(checked) =>
                                      handleAllowedUserToggle(member.userId, checked as boolean)
                                    }
                                  />
                                  <label
                                    htmlFor={`allowed-${member.id}`}
                                    className={cn(
                                      "flex-1 flex items-center gap-2 cursor-pointer",
                                      isDisabled && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={member.user.avatar || undefined} alt={member.user.firstName} />
                                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs">
                                        {getInitials(member.user.firstName, member.user.lastName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium truncate">
                                          {member.user.firstName} {member.user.lastName}
                                        </p>
                                        {isMemberAdmin && (
                                          <Shield className="h-3 w-3 text-primary" />
                                        )}
                                      </div>
                                    </div>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delete Group Section */}
              {canManage && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Group
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This will permanently delete the group and all messages. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{chat?.chatName}&quot;? This will permanently delete the group and all messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

