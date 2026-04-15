/**
 * Socket.IO Client Wrapper
 * Handles real-time communication with the server
 */

import { io, Socket } from 'socket.io-client';
import { api } from './api-client';
import { env } from '@/config/env';

let socketInstance: Socket | null = null;

/**
 * Get Socket.IO server URL from API URL
 */
function getSocketUrl(): string {
  const apiUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  // Remove /api suffix and use the base URL for Socket.IO
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return baseUrl;
}

/**
 * Initialize Socket.IO connection
 */
export function initSocket(): Socket | null {
  // Return existing instance if already connected
  if (socketInstance?.connected) {
    console.log('[Socket] Already connected, reusing instance', socketInstance.id);
    return socketInstance;
  }

  // Clean up existing instance if disconnected
  if (socketInstance && !socketInstance.connected) {
    console.log('[Socket] Cleaning up disconnected instance');
    socketInstance.removeAllListeners();
    socketInstance = null;
  }

  // Get token from API client
  const token = api.getAccessToken();
  if (!token) {
    console.warn('[Socket] No access token available, cannot initialize socket');
    return null;
  }

  const socketUrl = getSocketUrl();
  console.log('[Socket] Initializing connection to', socketUrl);

  try {
    // Create new socket instance
    socketInstance = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('[Socket] ✅ Connected successfully', {
        socketId: socketInstance?.id,
        transport: socketInstance?.io.engine?.transport?.name,
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Disconnected', {
        reason,
        socketId: socketInstance?.id,
      });
    });

    socketInstance.on('connect_error', (error: Error & { type?: string; description?: unknown }) => {
      const errorInfo: Record<string, unknown> = {
        message: error.message || 'Unknown error',
      };
      
      // Safely extract error properties (Socket.IO errors have type and description)
      if (error.type) {
        errorInfo.type = error.type;
      }
      
      if (error.description !== undefined) {
        errorInfo.description = error.description instanceof Error 
          ? error.description.message 
          : String(error.description);
      }
      
      console.error('[Socket] ⚠️ Connection error:', errorInfo);
      console.error('[Socket] Connection details:', {
        socketUrl,
        apiUrl: env.NEXT_PUBLIC_API_URL,
        hasToken: !!token,
      });
      console.error('[Socket] Full error:', error);
      
      // Socket.IO will automatically attempt reconnection based on configured settings
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('[Socket] 🔄 Reconnected successfully', {
        attemptNumber,
        socketId: socketInstance?.id,
      });
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] 🔄 Reconnection attempt', { attemptNumber });
    });

    socketInstance.on('reconnect_error', (error: Error) => {
      console.warn('[Socket] ⚠️ Reconnection error:', {
        message: error.message,
      });
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('[Socket] ❌ Reconnection failed - maximum attempts reached');
    });

    socketInstance.on('connected', (data) => {
      console.log('[Socket] ✅ Connection confirmed by server', data);
    });

    return socketInstance;
  } catch (error) {
    console.error('[Socket] ❌ Failed to initialize socket:', error);
    socketInstance = null;
    return null;
  }
}

/**
 * Get socket instance (initialize if needed)
 */
export function getSocket(): Socket | null {
  if (!socketInstance || !socketInstance.connected) {
    return initSocket();
  }
  return socketInstance;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Join a chat room
 */
export function joinChat(chatId: string): void {
  const socket = getSocket();
  if (socket) {
    socket.emit('joinChat', chatId);
  }
}

/**
 * Leave a chat room
 */
export function leaveChat(chatId: string): void {
  const socket = getSocket();
  if (socket) {
    socket.emit('leaveChat', chatId);
  }
}

/**
 * Subscribe to chat events
 */
export function subscribeToChatEvents(
  chatId: string,
  handlers: {
    onNewMessage?: (data: { chatId: string; message: unknown; senderId?: string }) => void;
    onMessageEdited?: (data: { chatId: string; messageId: string; message: unknown }) => void;
    onMessageDeleted?: (data: { chatId: string; messageId: string }) => void;
    onMessageReaction?: (data: { chatId: string; messageId: string; reaction: unknown; userId?: string }) => void;
    onTyping?: (data: { userId: string; chatId: string }) => void;
    onStopTyping?: (data: { userId: string; chatId: string }) => void;
    onUserLeftGroup?: (data: { chatId: string; userId: string; leftAt: string }) => void;
    onUserJoinedGroup?: (data: { chatId: string; userId: string; userName: string; joinedAt: string }) => void;
    onViewOnceOpened?: (data: { messageId: string; openedBy: string; openedAt: string }) => void;
    onMessagesRead?: (data: { chatId: string; userId: string }) => void;
  }
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {}; // Return no-op cleanup function
  }

  // Join the chat room
  joinChat(chatId);

  // Set up event listeners
  if (handlers.onNewMessage) {
    socket.on('newMessage', handlers.onNewMessage);
  }
  if (handlers.onMessageEdited) {
    socket.on('messageEdited', handlers.onMessageEdited);
  }
  if (handlers.onMessageDeleted) {
    socket.on('messageDeleted', handlers.onMessageDeleted);
  }
  if (handlers.onMessageReaction) {
    socket.on('messageReaction', handlers.onMessageReaction);
  }
  if (handlers.onTyping) {
    socket.on('typing', handlers.onTyping);
  }
  if (handlers.onStopTyping) {
    socket.on('stopTyping', handlers.onStopTyping);
  }
  if (handlers.onUserLeftGroup) {
    socket.on('userLeftGroup', handlers.onUserLeftGroup);
  }
  if (handlers.onUserJoinedGroup) {
    socket.on('userJoinedGroup', handlers.onUserJoinedGroup);
  }
  if (handlers.onViewOnceOpened) {
    socket.on('viewOnceOpened', handlers.onViewOnceOpened);
  }
  if (handlers.onMessagesRead) {
    socket.on('messagesRead', handlers.onMessagesRead);
  }

  // Return cleanup function
  return () => {
    if (socket) {
      if (handlers.onNewMessage) socket.off('newMessage', handlers.onNewMessage);
      if (handlers.onMessageEdited) socket.off('messageEdited', handlers.onMessageEdited);
      if (handlers.onMessageDeleted) socket.off('messageDeleted', handlers.onMessageDeleted);
      if (handlers.onMessageReaction) socket.off('messageReaction', handlers.onMessageReaction);
      if (handlers.onTyping) socket.off('typing', handlers.onTyping);
      if (handlers.onStopTyping) socket.off('stopTyping', handlers.onStopTyping);
      if (handlers.onMessagesRead) socket.off('messagesRead', handlers.onMessagesRead);
      if (handlers.onUserLeftGroup) socket.off('userLeftGroup', handlers.onUserLeftGroup);
      if (handlers.onUserJoinedGroup) socket.off('userJoinedGroup', handlers.onUserJoinedGroup);
      if (handlers.onViewOnceOpened) socket.off('viewOnceOpened', handlers.onViewOnceOpened);
      leaveChat(chatId);
    }
  };
}

/**
 * Subscribe to user-level events (not tied to a specific chat)
 */
export function subscribeToUserEvents(
  handlers: {
    onGroupLeft?: (data: { chatId: string; chatName: string }) => void;
  }
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {}; // Return no-op cleanup function
  }

  // Set up event listeners
  if (handlers.onGroupLeft) {
    socket.on('groupLeft', handlers.onGroupLeft);
  }

  // Return cleanup function
  return () => {
    if (socket) {
      if (handlers.onGroupLeft) socket.off('groupLeft', handlers.onGroupLeft);
    }
  };
}

/**
 * Emit typing indicator
 */
export function emitTyping(chatId: string): void {
  const socket = getSocket();
  if (socket) {
    socket.emit('typing:start', { roomId: `chat:${chatId}` });
  }
}

/**
 * Emit stop typing indicator
 */
export function emitStopTyping(chatId: string): void {
  const socket = getSocket();
  if (socket) {
    socket.emit('typing:stop', { roomId: `chat:${chatId}` });
  }
}

/**
 * Subscribe to unread count updates
 */
export function subscribeToUnreadCountUpdates(
  onUpdate: (data: { totalUnread: number; chatId?: string }) => void
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {}; // Return no-op cleanup function
  }

  socket.on('unreadCountUpdate', onUpdate);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('unreadCountUpdate', onUpdate);
    }
  };
}

// ============================================
// NOTIFICATION EVENTS
// ============================================

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  icon?: string;
  actionUrl?: string;
  createdAt: string;
}

export interface NotificationCountEvent {
  unreadCount: number;
  urgentCount: number;
  highCount: number;
}

/**
 * Subscribe to real-time notification events
 */
export function subscribeToNotificationEvents(handlers: {
  onNew?: (data: NotificationEvent) => void;
  onCount?: (data: NotificationCountEvent) => void;
}): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  if (handlers.onNew) socket.on('notification:new', handlers.onNew);
  if (handlers.onCount) socket.on('notification:count', handlers.onCount);

  return () => {
    if (socket) {
      if (handlers.onNew) socket.off('notification:new', handlers.onNew);
      if (handlers.onCount) socket.off('notification:count', handlers.onCount);
    }
  };
}

// ============================================
// VISION COACHING EVENTS
// ============================================

export interface VisionStateEvent {
  exerciseDetected: string | null;
  repCount: number;
  attentionState: 'focused' | 'distracted' | 'unknown';
  confidence: number;
}

export interface VisionCoachingEvent {
  message: string;
  severity: 'info' | 'warning';
  timestamp: number;
}

export interface VisionFoodEvent {
  item: string;
  timestamp: number;
}

/**
 * Subscribe to real-time vision coaching events
 */
export function subscribeToVisionEvents(handlers: {
  onState?: (data: VisionStateEvent) => void;
  onCoaching?: (data: VisionCoachingEvent) => void;
  onThrottle?: (data: { intervalMs: number }) => void;
  onError?: (data: { message: string }) => void;
  onFood?: (data: VisionFoodEvent) => void;
}): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  if (handlers.onState) socket.on('vision:state', handlers.onState);
  if (handlers.onCoaching) socket.on('vision:coaching', handlers.onCoaching);
  if (handlers.onThrottle) socket.on('vision:throttle', handlers.onThrottle);
  if (handlers.onError) socket.on('vision:error', handlers.onError);
  if (handlers.onFood) socket.on('vision:food', handlers.onFood);

  return () => {
    if (socket) {
      if (handlers.onState) socket.off('vision:state', handlers.onState);
      if (handlers.onCoaching) socket.off('vision:coaching', handlers.onCoaching);
      if (handlers.onThrottle) socket.off('vision:throttle', handlers.onThrottle);
      if (handlers.onError) socket.off('vision:error', handlers.onError);
      if (handlers.onFood) socket.off('vision:food', handlers.onFood);
    }
  };
}

// ============================================
// STREAK EVENTS
// ============================================

/**
 * Subscribe to streak status updates (e.g. activity logged, streak count changed)
 */
export function subscribeToStreakUpdated(
  callback: (data: { currentStreak: number; longestStreak: number; todayActivities: string[] }) => void,
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on('streak:updated', callback);
  return () => {
    socket.off('streak:updated', callback);
  };
}

/**
 * Subscribe to streak broken events (user missed a day without a freeze)
 */
export function subscribeToStreakBroken(
  callback: (data: { previousStreak: number }) => void,
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on('streak:broken', callback);
  return () => {
    socket.off('streak:broken', callback);
  };
}

/**
 * Subscribe to streak freeze applied events
 */
export function subscribeToStreakFreeze(
  callback: (data: { freezesRemaining: number; date: string }) => void,
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on('streak:freeze_applied', callback);
  return () => {
    socket.off('streak:freeze_applied', callback);
  };
}

/**
 * Subscribe to streak at-risk warnings (approaching midnight without activity)
 */
export function subscribeToStreakAtRisk(
  callback: (data: { hoursRemaining: number; currentStreak: number }) => void,
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on('streak:at_risk', callback);
  return () => {
    socket.off('streak:at_risk', callback);
  };
}

/**
 * Subscribe to streak milestone achievements (tier unlocked, XP bonus, etc.)
 */
export function subscribeToStreakMilestone(
  callback: (data: {
    days: number;
    tierName: string;
    xpBonus: number;
    freezesEarned: number;
    titleUnlocked: string | null;
    badgeIcon: string;
  }) => void,
): () => void {
  const socket = getSocket();
  if (!socket) {
    return () => {};
  }

  socket.on('streak:milestone', callback);
  return () => {
    socket.off('streak:milestone', callback);
  };
}

/**
 * Emit a vision frame to the server
 */
export function emitVisionFrame(frameBase64: string): void {
  const socket = getSocket();
  if (!socket) return;
  socket.emit('vision:frame', { frameBase64, timestamp: Date.now() });
}

/**
 * Start a vision coaching session
 */
export function startVisionSession(): void {
  const socket = getSocket();
  if (!socket) return;
  socket.emit('vision:start');
}

/**
 * Stop a vision coaching session
 */
export function stopVisionSession(): void {
  const socket = getSocket();
  if (!socket) return;
  socket.emit('vision:stop');
}
