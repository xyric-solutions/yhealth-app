/**
 * Chat Service
 * Client-side service for person-to-person messaging
 */

import { api } from '@/lib/api-client';
import { transformKeysToCamelCase } from '../utils/case-transform';

// ============================================================================
// Types
// ============================================================================

export interface Chat {
  id: string;
  chatName: string;
  isGroupChat: boolean;
  isCommunity: boolean;
  avatar: string | null;
  groupAdmin: string | null;
  latestMessageId: string | null;
  joinCode?: string | null;
  joinCodeExpiresAt?: string | null;
  createdBy?: string | null;
  messagePermissionMode?: 'all' | 'restricted';
  allowedSenderIds?: string[];
  createdAt: string;
  updatedAt: string;
  participants?: Array<{
    id: string;
    userId: string;
    joinedAt: string;
    leftAt: string | null;
    isBlocked: boolean;
    unreadCount: number;
    lastReadAt: string | null;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar: string | null;
      role: string;
    };
  }>;
  latestMessage?: {
    id: string;
    content: string;
    contentType: string;
    senderId: string;
    createdAt: string;
    sender?: {
      id: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
  };
}

export interface GroupMember {
  id: string;
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
    role: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string | null;
  contentType: string;
  mediaUrl: string | null;
  mediaThumbnail: string | null;
  mediaSize: number | null;
  mediaDuration: number | null;
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedBy: string | null;
  repliedToId: string | null;
  forwardedFromId: string | null;
  forwardedBy: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
    role: string;
  };
  repliedTo?: Message | null;
  forwardedFrom?: Message | null;
  reactions?: Array<{
    emoji: string;
    userIds: string[];
    count: number;
  }>;
  isStarred?: boolean;
  readBy?: string[];
  isViewOnce?: boolean;
  viewOnceOpenedAt?: string | null;
}

interface _CreateChatParams {
  userId: string;
  chatName?: string;
  isGroupChat: boolean;
  avatar?: string;
  userIds?: string[];
}

interface SendMessageParams {
  chatId: string;
  content?: string;
  contentType?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaSize?: number;
  mediaDuration?: number;
  repliedTo?: string;
  isViewOnce?: boolean;
}

// ============================================================================
// Chat Service
// ============================================================================

class ChatService {
  private readonly baseUrl = '/chats';
  private readonly messagesUrl = '/messages';

  /**
   * Create a one-on-one chat
   */
  async createChat(params: { userId: string }): Promise<Chat> {
    const response = await api.post<Chat>(this.baseUrl, {
      userId: params.userId,
    });
    if (!response.success || !response.data) {
      throw new Error('Failed to create chat');
    }
    return response.data;
  }

  /**
   * Create a group chat
   */
  async createGroupChat(params: {
    chatName: string;
    users: string[];
    avatar?: string;
  }): Promise<Chat> {
    const response = await api.post<unknown>(`${this.baseUrl}/group`, params);
    if (!response.success || !response.data) {
      throw new Error('Failed to create group chat');
    }
    return transformKeysToCamelCase<Chat>(response.data);
  }

  /**
   * Get user's chats
   */
  async getChats(params?: { page?: number; limit?: number }): Promise<Chat[]> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = queryParams.toString() ? `${this.baseUrl}?${queryParams}` : this.baseUrl;
    const response = await api.get<unknown[]>(url);
    if (!response.success || !response.data) {
      throw new Error('Failed to get chats');
    }
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map((chat) => transformKeysToCamelCase<Chat>(chat));
  }

  /**
   * Get chat by ID
   */
  async getChatById(chatId: string): Promise<Chat> {
    const response = await api.get<unknown>(`${this.baseUrl}/${chatId}`);
    if (!response.success || !response.data) {
      throw new Error('Failed to get chat');
    }
    return transformKeysToCamelCase<Chat>(response.data);
  }

  /**
   * Delete chat
   */
  async deleteChat(chatId: string): Promise<void> {
    const response = await api.delete(`${this.baseUrl}/${chatId}`);
    if (!response.success) {
      throw new Error('Failed to delete chat');
    }
  }

  /**
   * Send a message
   */
  async sendMessage(params: SendMessageParams): Promise<Message> {
    const response = await api.post<unknown>(this.messagesUrl, params);
    if (!response.success || !response.data) {
      throw new Error('Failed to send message');
    }
    return transformKeysToCamelCase<Message>(response.data);
  }

  /**
   * Upload media file
   */
  async uploadMedia(file: File): Promise<{ url: string; thumbnail?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    // Determine contentType from file MIME type
    let contentType: 'image' | 'video' | 'audio' | 'document';
    if (file.type.startsWith('image/')) {
      contentType = 'image';
    } else if (file.type.startsWith('video/')) {
      contentType = 'video';
    } else if (file.type.startsWith('audio/')) {
      contentType = 'audio';
    } else {
      contentType = 'document';
    }

    formData.append('contentType', contentType);

    const response = await api.post<{ 
      url?: string; 
      thumbnail?: string;
      mediaUrl?: string;
      mediaThumbnail?: string;
    }>(
      `${this.messagesUrl}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to upload media');
    }
    
    // Handle both response formats: { url, thumbnail } or { mediaUrl, mediaThumbnail }
    const data = response.data;
    return {
      url: data.url || data.mediaUrl || '',
      thumbnail: data.thumbnail || data.mediaThumbnail,
    };
  }

  /**
   * Get messages for a chat
   */
  async getMessages(
    chatId: string,
    params?: { page?: number; limit?: number }
  ): Promise<Message[]> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = queryParams.toString()
      ? `${this.messagesUrl}/chat/${chatId}?${queryParams}`
      : `${this.messagesUrl}/chat/${chatId}`;
    const response = await api.get<unknown[]>(url);
    if (!response.success || !response.data) {
      throw new Error('Failed to get messages');
    }
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map((message) => transformKeysToCamelCase<Message>(message));
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, content: string): Promise<Message> {
    const response = await api.put<Message>(`${this.messagesUrl}/${messageId}`, { content });
    if (!response.success || !response.data) {
      throw new Error('Failed to edit message');
    }
    return response.data;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const response = await api.delete(`${this.messagesUrl}/${messageId}`);
    if (!response.success) {
      throw new Error('Failed to delete message');
    }
  }

  /**
   * Forward a message
   */
  async forwardMessage(messageId: string, chatIds: string[]): Promise<void> {
    const response = await api.post(`${this.messagesUrl}/${messageId}/forward`, { chatIds });
    if (!response.success) {
      throw new Error('Failed to forward message');
    }
  }

  /**
   * Star/unstar a message
   */
  async toggleStarMessage(messageId: string): Promise<{ isStarred: boolean }> {
    const response = await api.post<{ isStarred: boolean }>(
      `${this.messagesUrl}/${messageId}/star`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to toggle star message');
    }
    return response.data;
  }

  /**
   * Pin/unpin a message
   */
  async togglePinMessage(messageId: string): Promise<{ isPinned: boolean }> {
    const response = await api.post<{ isPinned: boolean }>(
      `${this.messagesUrl}/${messageId}/pin`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to toggle pin message');
    }
    return response.data;
  }

  /**
   * Add reaction to a message
   */
  async addReaction(messageId: string, emoji: string): Promise<void> {
    const response = await api.post(`${this.messagesUrl}/${messageId}/reaction`, { emoji });
    if (!response.success) {
      throw new Error('Failed to add reaction');
    }
  }

  /**
   * Open a view-once message (one-time media access)
   */
  async openViewOnceMessage(messageId: string): Promise<{ mediaUrl: string; mediaThumbnail?: string }> {
    const response = await api.post<{ mediaUrl: string; mediaThumbnail?: string }>(
      `${this.messagesUrl}/${messageId}/view-once`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to open view-once message');
    }
    return response.data;
  }

  /**
   * Mark chat as read
   */
  async markChatAsRead(chatId: string): Promise<void> {
    const response = await api.post(`${this.messagesUrl}/chat/${chatId}/read-all`);
    if (!response.success) {
      throw new Error('Failed to mark chat as read');
    }
  }

  /**
   * Join group by code
   */
  async joinGroupByCode(code: string): Promise<Chat> {
    const response = await api.post<unknown>(`${this.baseUrl}/join-by-code`, { code });
    if (!response.success || !response.data) {
      throw new Error('Failed to join group');
    }
    return transformKeysToCamelCase<Chat>(response.data);
  }

  /**
   * Regenerate join code (admin/creator only)
   */
  async regenerateJoinCode(chatId: string): Promise<{ joinCode: string }> {
    const response = await api.post<{ joinCode: string }>(`${this.baseUrl}/group/${chatId}/regenerate-code`);
    if (!response.success || !response.data) {
      throw new Error('Failed to regenerate join code');
    }
    return transformKeysToCamelCase<{ joinCode: string }>(response.data);
  }

  /**
   * Delete group (admin/creator only)
   */
  async deleteGroup(chatId: string): Promise<void> {
    const response = await api.delete(`${this.baseUrl}/group/${chatId}`);
    if (!response.success) {
      throw new Error('Failed to delete group');
    }
  }

  /**
   * Get group members
   */
  async getGroupMembers(chatId: string): Promise<GroupMember[]> {
    const response = await api.get<unknown[]>(`${this.baseUrl}/group/${chatId}/members`);
    if (!response.success || !response.data) {
      throw new Error('Failed to get group members');
    }
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map((member) => transformKeysToCamelCase<GroupMember>(member));
  }

  /**
   * Update message permissions (admin only)
   */
  async updateMessagePermissions(
    chatId: string,
    mode: 'all' | 'restricted',
    allowedUserIds?: string[]
  ): Promise<void> {
    const response = await api.put(`${this.baseUrl}/group/${chatId}/message-permissions`, {
      mode,
      allowedUserIds,
    });
    if (!response.success) {
      throw new Error('Failed to update message permissions');
    }
  }

  /**
   * Rename group chat
   */
  async renameGroupChat(chatId: string, chatName: string, avatar?: string | null): Promise<Chat> {
    const response = await api.post<unknown>(`${this.baseUrl}/group/${chatId}/rename`, {
      chatName,
      avatar,
    });
    if (!response.success || !response.data) {
      throw new Error('Failed to rename group chat');
    }
    return transformKeysToCamelCase<Chat>(response.data);
  }

  /**
   * Leave group chat (remove current user from group)
   */
  async leaveGroupChat(chatId: string, userId: string): Promise<void> {
    const response = await api.post(`${this.baseUrl}/group/${chatId}/remove-user`, {
      userId,
    });
    if (!response.success) {
      throw new Error('Failed to leave group chat');
    }
  }
}

export const chatService = new ChatService();

