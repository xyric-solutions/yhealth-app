import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { updateUserOnlineStatus } from '../utils/user.helpers.js';
import { competitionStreamService } from './competition-stream.service.js';
import { visionCoachingService } from './vision-coaching.service.js';
import type { IJwtPayload, SocketUser, UserRole } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user?: IJwtPayload;
}

class SocketService {
  private static instance: SocketService;
  private io: Server | null = null;
  private connectedUsers: Map<string, SocketUser> = new Map();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Socket.IO with HTTP server
   */
  public initialize(httpServer: HttpServer): Server {
    this.io = new Server(httpServer, {
      cors: {
        origin: env.cors.origin,
        credentials: env.cors.credentials,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
      allowEIO3: true, // Allow Engine.IO v3 clients
    });
    
    logger.info('Socket.IO server initialized', {
      corsOrigins: env.cors.origin,
      credentials: env.cors.credentials,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Socket.IO initialized');
    return this.io;
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    if (!this.io) return;

    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth['token'] ||
          socket.handshake.headers['authorization']?.replace('Bearer ', '') ||
          socket.handshake.query['token'];

        if (!token || typeof token !== 'string') {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, env.jwt.secret, {
          issuer: env.jwt.issuer,
          audience: env.jwt.audience,
        }) as IJwtPayload;

        socket.user = decoded;
        next();
      } catch (error) {
        logger.warn('Socket authentication failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.user;

      if (!user) {
        socket.disconnect(true);
        return;
      }

      // Track connected user
      const socketUser: SocketUser = {
        id: socket.id,
        socketId: socket.id,
        userId: user.userId,
        role: user.role,
        joinedAt: new Date(),
      };

      this.connectedUsers.set(socket.id, socketUser);

      // Join user-specific room
      socket.join(`user:${user.userId}`);

      // Join role-based room
      socket.join(`role:${user.role}`);

      logger.info('Socket connected', {
        socketId: socket.id,
        userId: user.userId,
        role: user.role,
      });

      // Update user online status
      updateUserOnlineStatus(user.userId, true).catch((error) => {
        logger.error('Failed to update user online status on connect', {
          userId: user.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      // Emit connection success
      socket.emit('connected', {
        socketId: socket.id,
        userId: user.userId,
        connectedAt: new Date().toISOString(),
      });

      // Handle custom events
      this.setupSocketEvents(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.connectedUsers.delete(socket.id);
        logger.info('Socket disconnected', {
          socketId: socket.id,
          userId: user.userId,
          reason,
        });

        // Update user online status (set to offline)
        // Check if user has any other active connections
        const hasOtherConnections = Array.from(this.connectedUsers.values()).some(
          (connectedUser) => connectedUser.userId === user.userId && connectedUser.id !== socket.id
        );

        if (!hasOtherConnections) {
          // Clean up any active streams or viewer sessions
          competitionStreamService.handleDisconnect(user.userId);

          updateUserOnlineStatus(user.userId, false).catch((error) => {
            logger.error('Failed to update user online status on disconnect', {
              userId: user.userId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error', {
          socketId: socket.id,
          userId: user.userId,
          error: error.message,
        });
      });
    });
  }

  /**
   * Setup custom socket events
   */
  private setupSocketEvents(socket: AuthenticatedSocket): void {
    // Join a room
    socket.on('join:room', (roomId: string) => {
      socket.join(roomId);
      logger.debug('Socket joined room', { socketId: socket.id, roomId });
      socket.emit('room:joined', { roomId });
    });

    // Leave a room
    socket.on('leave:room', (roomId: string) => {
      socket.leave(roomId);
      logger.debug('Socket left room', { socketId: socket.id, roomId });
      socket.emit('room:left', { roomId });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Typing indicator
    socket.on('typing:start', (data: { roomId: string }) => {
      socket.to(data.roomId).emit('typing', {
        userId: socket.user?.userId,
        roomId: data.roomId,
      });
    });

    socket.on('typing:stop', (data: { roomId: string }) => {
      socket.to(data.roomId).emit('stopTyping', {
        userId: socket.user?.userId,
        roomId: data.roomId,
      });
    });

    // ============================================
    // Chat Events
    // ============================================

    // Join chat room
    socket.on('joinChat', (chatId: string) => {
      socket.join(`chat:${chatId}`);
      logger.debug('User joined chat', {
        socketId: socket.id,
        userId: socket.user?.userId,
        chatId,
      });
      socket.emit('chatJoined', { chatId });
    });

    // Leave chat room
    socket.on('leaveChat', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
      logger.debug('User left chat', {
        socketId: socket.id,
        userId: socket.user?.userId,
        chatId,
      });
      socket.emit('chatLeft', { chatId });
    });

    // New message event (broadcast to chat room)
    socket.on('newMessage', (data: { chatId: string; message: unknown }) => {
      if (data.chatId) {
        socket.to(`chat:${data.chatId}`).emit('newMessage', {
          chatId: data.chatId,
          message: data.message,
          senderId: socket.user?.userId,
        });
        logger.debug('New message broadcasted', {
          chatId: data.chatId,
          senderId: socket.user?.userId,
        });
      }
    });

    // Message edited event
    socket.on('messageEdited', (data: { chatId: string; messageId: string; message: unknown }) => {
      if (data.chatId && data.messageId) {
        socket.to(`chat:${data.chatId}`).emit('messageEdited', {
          chatId: data.chatId,
          messageId: data.messageId,
          message: data.message,
        });
      }
    });

    // Message deleted event
    socket.on('messageDeleted', (data: { chatId: string; messageId: string }) => {
      if (data.chatId && data.messageId) {
        socket.to(`chat:${data.chatId}`).emit('messageDeleted', {
          chatId: data.chatId,
          messageId: data.messageId,
        });
      }
    });

    // Typing indicator for chat
    socket.on('typing', (data: { chatId: string }) => {
      if (data.chatId) {
        socket.to(`chat:${data.chatId}`).emit('typing', {
          userId: socket.user?.userId,
          chatId: data.chatId,
        });
      }
    });

    // Stop typing indicator
    socket.on('stopTyping', (data: { chatId: string }) => {
      if (data.chatId) {
        socket.to(`chat:${data.chatId}`).emit('stopTyping', {
          userId: socket.user?.userId,
          chatId: data.chatId,
        });
      }
    });

    // Message reaction event
    socket.on('messageReaction', (data: { chatId: string; messageId: string; reaction: unknown }) => {
      if (data.chatId && data.messageId) {
        socket.to(`chat:${data.chatId}`).emit('messageReaction', {
          chatId: data.chatId,
          messageId: data.messageId,
          reaction: data.reaction,
          userId: socket.user?.userId,
        });
      }
    });

    // Message read event
    socket.on('messageRead', (data: { chatId: string; messageId: string }) => {
      if (data.chatId && data.messageId) {
        socket.to(`chat:${data.chatId}`).emit('messageRead', {
          chatId: data.chatId,
          messageId: data.messageId,
          userId: socket.user?.userId,
        });
      }
    });

    // Message pinned event
    socket.on('messagePinned', (data: { chatId: string; messageId: string; message: unknown }) => {
      if (data.chatId && data.messageId) {
        socket.to(`chat:${data.chatId}`).emit('messagePinned', {
          chatId: data.chatId,
          messageId: data.messageId,
          message: data.message,
        });
      }
    });

    // Message starred event
    socket.on('messageStarred', (data: { chatId: string; messageId: string; message: unknown }) => {
      if (data.chatId && data.messageId) {
        socket.to(`chat:${data.chatId}`).emit('messageStarred', {
          chatId: data.chatId,
          messageId: data.messageId,
          message: data.message,
          userId: socket.user?.userId,
        });
      }
    });

    // Mark read broadcast
    socket.on('markRead', (data: { chatId: string; userId: string }) => {
      if (data.chatId) {
        socket.to(`chat:${data.chatId}`).emit('messagesRead', {
          chatId: data.chatId,
          userId: data.userId,
        });
      }
    });

    // ============================================
    // Video Room Events (N-to-N mesh)
    // ============================================

    // User joins the shared video room for a competition
    socket.on('room:join', async (data: { competitionId: string }) => {
      if (!data.competitionId || !socket.user?.userId) return;
      try {
        const { participant, existingParticipants } =
          await competitionStreamService.joinRoom(
            data.competitionId,
            socket.user.userId,
          );

        // Join the socket room so this user receives broadcasts
        socket.join(competitionStreamService.roomName(data.competitionId));

        // Send back the list of existing participants so the new user
        // can create WebRTC peer connections with each of them
        socket.emit('room:participants-list', {
          competitionId: data.competitionId,
          participants: existingParticipants,
          self: participant,
        });
      } catch (error) {
        logger.error('[Socket] room:join error', {
          error: error instanceof Error ? error.message : String(error),
          userId: socket.user.userId,
        });
        socket.emit('room:error', { message: 'Failed to join room' });
      }
    });

    // User leaves the video room
    socket.on('room:leave', (data: { competitionId: string }) => {
      if (!data.competitionId || !socket.user?.userId) return;
      competitionStreamService.leaveRoom(
        data.competitionId,
        socket.user.userId,
      );
      socket.leave(competitionStreamService.roomName(data.competitionId));
    });

    // User toggles audio/video
    socket.on(
      'room:media-state',
      (data: {
        competitionId: string;
        audioEnabled?: boolean;
        videoEnabled?: boolean;
      }) => {
        if (!data.competitionId || !socket.user?.userId) return;
        competitionStreamService.updateMediaState(
          data.competitionId,
          socket.user.userId,
          {
            audioEnabled: data.audioEnabled,
            videoEnabled: data.videoEnabled,
          },
        );
      },
    );

    // WebRTC signaling: relay offer (peer → peer)
    socket.on(
      'room:offer',
      (data: { targetUserId: string; sdp: string; competitionId: string }) => {
        if (!data.targetUserId || !data.sdp || !socket.user?.userId) return;
        competitionStreamService.relayOffer(
          data.targetUserId,
          socket.user.userId,
          data.competitionId,
          data.sdp,
        );
      },
    );

    // WebRTC signaling: relay answer (peer → peer)
    socket.on(
      'room:answer',
      (data: { targetUserId: string; sdp: string; competitionId: string }) => {
        if (!data.targetUserId || !data.sdp || !socket.user?.userId) return;
        competitionStreamService.relayAnswer(
          data.targetUserId,
          socket.user.userId,
          data.competitionId,
          data.sdp,
        );
      },
    );

    // WebRTC signaling: relay ICE candidate (peer → peer)
    socket.on(
      'room:ice-candidate',
      (data: {
        targetUserId: string;
        competitionId: string;
        candidate: {
          candidate: string;
          sdpMLineIndex: number | null;
          sdpMid: string | null;
        };
      }) => {
        if (!data.targetUserId || !data.candidate || !socket.user?.userId) return;
        competitionStreamService.relayIceCandidate(
          data.targetUserId,
          socket.user.userId,
          data.competitionId,
          data.candidate,
        );
      },
    );

    // ============================================
    // VISION COACHING EVENTS
    // ============================================

    socket.on('vision:start', (callback?: (ack: { sessionId: string; frameInterval: number }) => void) => {
      if (!socket.user?.userId) return;
      const session = visionCoachingService.getOrCreateSession(socket.user.userId);
      logger.info('[Socket] Vision coaching started', { userId: socket.user.userId });
      if (typeof callback === 'function') {
        callback({ sessionId: socket.user.userId, frameInterval: session.frameInterval });
      } else {
        socket.emit('vision:started', { sessionId: socket.user.userId, frameInterval: session.frameInterval });
      }
    });

    socket.on('vision:frame', async (data: { frameBase64: string; timestamp: number }) => {
      if (!socket.user?.userId || !data?.frameBase64) return;
      const userId = socket.user.userId;

      const session = visionCoachingService.getOrCreateSession(userId);
      if (session.isProcessing) {
        // Drop frame if previous analysis still in-flight
        return;
      }

      session.isProcessing = true;
      try {
        const result = await visionCoachingService.analyzeFrame(userId, data.frameBase64);

        if (!result) {
          // Frame was too similar to previous, no new analysis
          session.isProcessing = false;
          return;
        }
        // Reset error counter on success
        session.consecutiveErrors = 0;

        // Emit state update (exercise, reps, attention)
        const state = visionCoachingService.getSessionState(userId);
        if (state) {
          socket.emit('vision:state', {
            exerciseDetected: state.exerciseDetected,
            repCount: state.repCount,
            attentionState: state.attentionState,
            confidence: result.confidence,
          });
        }

        // Emit coaching correction if needed
        if (result.postureCorrection) {
          socket.emit('vision:coaching', {
            message: result.postureCorrection,
            severity: result.confidence > 0.7 ? 'warning' : 'info',
            timestamp: Date.now(),
          });
        }

        // Emit food detection
        if (result.foodDetected) {
          socket.emit('vision:food', {
            item: result.foodDetected,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);

        if (errMsg === 'RATE_LIMITED') {
          const newInterval = visionCoachingService.handleRateLimit(userId);
          socket.emit('vision:throttle', { intervalMs: newInterval });
        } else {
          // Track consecutive errors to suppress log spam
          session.consecutiveErrors = (session.consecutiveErrors || 0) + 1;
          if (session.consecutiveErrors <= 3) {
            logger.error('[Socket] Vision frame analysis failed', { userId, error: errMsg, consecutiveErrors: session.consecutiveErrors });
          } else if (session.consecutiveErrors === 4) {
            logger.warn('[Socket] Vision analysis repeatedly failing, suppressing further errors', { userId, totalErrors: session.consecutiveErrors });
          }
          // Only emit error to client every 5th failure to avoid UI spam
          if (session.consecutiveErrors <= 3 || session.consecutiveErrors % 5 === 0) {
            socket.emit('vision:error', { message: 'Vision analysis temporarily unavailable' });
          }
        }
      } finally {
        session.isProcessing = false;
      }
    });

    socket.on('vision:stop', () => {
      if (!socket.user?.userId) return;
      visionCoachingService.endSession(socket.user.userId);
      logger.info('[Socket] Vision coaching stopped', { userId: socket.user.userId });
    });
  }

  /**
   * Emit event to specific user
   */
  public emitToUser(userId: string, event: string, data: unknown): void {
    try {
      if (!this.io) {
        logger.warn('[SocketService] Cannot emit - Socket.IO not initialized', {
          userId,
          event,
        });
        return;
      }
      
      const room = `user:${userId}`;
      const socketsInRoom = this.io.sockets.adapter.rooms.get(room);
      const socketCount = socketsInRoom ? socketsInRoom.size : 0;
      
      logger.debug('[SocketService] Preparing to emit to user', {
        userId,
        event,
        room,
        socketCount,
        hasData: !!data,
        dataType: typeof data,
      });
      
      if (socketCount === 0) {
        logger.warn('[SocketService] No sockets found in room - user may not be connected', {
          userId,
          room,
          event,
        });
        // Still attempt to emit in case user connects shortly
      }
      
      try {
        this.io.to(room).emit(event, data);
        
        logger.info('[SocketService] Successfully emitted to user', {
          userId,
          event,
          room,
          socketCount,
          dataSize: typeof data === 'object' ? JSON.stringify(data).length : String(data).length,
        });
      } catch (emitError) {
        logger.error('[SocketService] Error during emit operation', {
          userId,
          event,
          room,
          error: emitError instanceof Error ? emitError.message : 'Unknown error',
          stack: emitError instanceof Error ? emitError.stack : undefined,
        });
        throw emitError;
      }
    } catch (error) {
      logger.error('[SocketService] Fatal error in emitToUser', {
        userId,
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - allow caller to continue processing
    }
  }

  /**
   * Emit event to users with specific role
   */
  public emitToRole(role: UserRole, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(`role:${role}`).emit(event, data);
  }

  /**
   * Emit event to a room
   */
  public emitToRoom(roomId: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Emit event to a chat room
   */
  public emitToChat(chatId: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(`chat:${chatId}`).emit(event, data);
  }

  /**
   * Emit event to all connected clients
   */
  public broadcast(event: string, data: unknown): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Get connected users count
   */
  public getConnectedCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get all connected users
   */
  public getConnectedUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values());
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return Array.from(this.connectedUsers.values()).some(
      user => user.userId === userId
    );
  }

  /**
   * Disconnect user by ID
   */
  public disconnectUser(userId: string): void {
    if (!this.io) return;

    const sockets = Array.from(this.connectedUsers.entries())
      .filter(([_, user]) => user.userId === userId)
      .map(([socketId]) => socketId);

    sockets.forEach(socketId => {
      this.io?.sockets.sockets.get(socketId)?.disconnect(true);
    });
  }

  /**
   * Get IO instance
   */
  public getIO(): Server | null {
    return this.io;
  }

  /**
   * Health check
   */
  public healthCheck(): { status: 'up' | 'down'; connections: number } {
    if (!this.io) {
      return { status: 'down', connections: 0 };
    }

    return {
      status: 'up',
      connections: this.getConnectedCount(),
    };
  }
}

export const socketService = SocketService.getInstance();
export default socketService;
