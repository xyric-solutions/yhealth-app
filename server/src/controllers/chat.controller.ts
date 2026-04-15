/**
 * @file Chat Controller
 * @description Handles chat-related API endpoints
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { chatService } from '../services/chat.service.js';
import cache from '../services/cache.service.js';

/**
 * POST /api/chats
 * Create a one-on-one chat
 */
export const createChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { userId: otherUserId } = req.body;

    if (!otherUserId) {
      throw ApiError.badRequest('User ID is required');
    }

    const chat = await chatService.createOrGetChat({
      userId,
      otherUserId,
      isGroupChat: false,
    });

    ApiResponse.success(res, chat, 'Chat created or retrieved successfully', 200, req);
  }
);

/**
 * GET /api/chats
 * Get user's chats with pagination
 */
export const getChats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const userRole = req.user?.role || 'user';
    const isAdmin = userRole === 'admin';

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const chats = await chatService.getUserChats(userId, isAdmin, page, limit);

    ApiResponse.success(
      res,
      chats,
      {
        message: 'Chats retrieved successfully',
        meta: {
          page,
          limit,
          total: chats.length,
          totalPages: Math.ceil(chats.length / limit),
          hasNextPage: page < Math.ceil(chats.length / limit),
          hasPrevPage: page > 1,
        },
      },
      200,
      req
    );
  }
);

/**
 * GET /api/chats/:id
 * Get chat details
 */
export const getChatById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const chat = await chatService.getChatById(id, userId);

    ApiResponse.success(res, chat, 'Chat retrieved successfully', 200, req);
  }
);

/**
 * POST /api/chats/group
 * Create a group chat
 */
export const createGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { chatName, users, avatar } = req.body;

    if (!chatName) {
      throw ApiError.badRequest('Group name is required');
    }

    if (!avatar) {
      throw ApiError.badRequest('Group avatar is required');
    }

    // Parse users if it's a string (from form data)
    // Allow creating group with 0 users - creator will be automatically added as participant
    const userIds = typeof users === 'string' ? JSON.parse(users) : (users || []);

    // Validate users is an array
    if (!Array.isArray(userIds)) {
      throw ApiError.badRequest('Users must be an array');
    }

    const groupChat = await chatService.createGroupChat({
      userId,
      chatName,
      userIds,
      avatar,
      isGroupChat: true,
    });

    ApiResponse.created(res, groupChat, 'Group chat created successfully', req);
  }
);

/**
 * PUT /api/chats/group/:id
 * Update group chat
 */
export const updateGroupChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { chatName, users, avatar } = req.body;

    if (!chatName || !users) {
      throw ApiError.badRequest('Group name and users are required');
    }

    if (!avatar) {
      throw ApiError.badRequest('Group avatar is required');
    }

    // Parse users if it's a string
    const userIds = typeof users === 'string' ? JSON.parse(users) : users;

    if (!Array.isArray(userIds) || userIds.length < 2) {
      throw ApiError.badRequest('Please select at least 2 users');
    }

    const updatedChat = await chatService.updateGroupChat({
      chatId: id,
      chatName,
      userIds,
      avatar,
    });

    ApiResponse.success(res, updatedChat, 'Group chat updated successfully', 200, req);
  }
);

/**
 * POST /api/chats/group/:id/rename
 * Rename group chat
 */
export const renameGroup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { chatName, avatar } = req.body;

    if (!chatName) {
      throw ApiError.badRequest('Chat name is required');
    }

    const updatedChat = await chatService.renameGroupChat(id, chatName, userId, avatar);

    ApiResponse.success(res, updatedChat, 'Group updated successfully', 200, req);
  }
);

/**
 * POST /api/chats/group/:id/add-user
 * Add user to group chat
 */
export const addUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      throw ApiError.badRequest('User ID is required');
    }

    const updatedChat = await chatService.addUserToGroup(id, targetUserId, userId);

    ApiResponse.success(res, updatedChat, 'User added to group successfully', 200, req);
  }
);

/**
 * POST /api/chats/group/:id/remove-user
 * Remove user from group chat
 */
export const removeUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      throw ApiError.badRequest('User ID is required');
    }

    const updatedChat = await chatService.removeUserFromGroup(id, targetUserId, userId);

    ApiResponse.success(res, updatedChat, 'User removed from group successfully', 200, req);
  }
);

/**
 * DELETE /api/chats/:id
 * Delete chat
 */
export const deleteChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    await chatService.deleteChat(id, userId);

    ApiResponse.success(res, null, 'Chat deleted successfully', 200, req);
  }
);

/**
 * POST /api/chats/join-by-code
 * Join group using 6-digit code
 */
export const joinGroupByCode = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { code } = req.body;

    if (!code) {
      throw ApiError.badRequest('Join code is required');
    }

    const chat = await chatService.joinGroupByCode(code, userId);

    ApiResponse.success(res, chat, 'Joined group successfully', 200, req);
  }
);

/**
 * POST /api/chats/group/:id/regenerate-code
 * Regenerate join code (admin/creator only)
 */
export const regenerateJoinCode = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const joinCode = await chatService.regenerateJoinCode(id, userId);

    ApiResponse.success(res, { joinCode }, 'Join code regenerated successfully', 200, req);
  }
);

/**
 * DELETE /api/chats/group/:id
 * Delete group (admin/creator only)
 */
export const deleteGroup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    await chatService.deleteGroup(id, userId);

    ApiResponse.success(res, null, 'Group deleted successfully', 200, req);
  }
);

/**
 * GET /api/chats/group/:id/members
 * Get group members
 */
export const getGroupMembers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const members = await chatService.getGroupMembers(id, userId);

    ApiResponse.success(res, members, 'Group members retrieved successfully', 200, req);
  }
);

/**
 * PUT /api/chats/group/:id/message-permissions
 * Update message permissions (admin only)
 */
export const updateMessagePermissions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { mode, allowedUserIds } = req.body;

    if (!mode || !['all', 'restricted'].includes(mode)) {
      throw ApiError.badRequest('Mode must be "all" or "restricted"');
    }

    const chat = await chatService.updateMessagePermissions(
      id,
      userId,
      mode as 'all' | 'restricted',
      allowedUserIds
    );

    ApiResponse.success(res, chat, 'Message permissions updated successfully', 200, req);
  }
);

/**
 * GET /api/chats/unread-count
 * Get total unread message count across all chats
 */
export const getTotalUnreadCount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Cache for 15 seconds per user — socket handles real-time updates
    const cacheKey = `unread-count:${userId}`;
    const unreadCount = await cache.getOrSet(cacheKey, async () => {
      return chatService.getTotalUnreadCount(userId);
    }, 15);

    ApiResponse.success(res, { unreadCount }, 'Unread count retrieved successfully', 200, req);
  }
);

