import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as chatController from '../controllers/chat.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Unread Count (must be before /:id routes)
// ============================================

// Get total unread message count across all chats
router.get('/unread-count', chatController.getTotalUnreadCount);

// ============================================
// Chat CRUD
// ============================================

// Create one-on-one chat
router.post('/', chatController.createChat);

// Get user's chats (with pagination)
router.get('/', chatController.getChats);

// Get chat by ID
router.get('/:id', chatController.getChatById);

// Delete chat
router.delete('/:id', chatController.deleteChat);

// ============================================
// Group Chat Management
// ============================================

// Create group chat
router.post('/group', chatController.createGroupChat);

// Update group chat
router.put('/group/:id', chatController.updateGroupChat);

// Rename group chat
router.post('/group/:id/rename', chatController.renameGroup);

// Add user to group
router.post('/group/:id/add-user', chatController.addUser);

// Remove user from group
router.post('/group/:id/remove-user', chatController.removeUser);

// Join group by code
router.post('/join-by-code', chatController.joinGroupByCode);

// Regenerate join code (admin/creator only)
router.post('/group/:id/regenerate-code', chatController.regenerateJoinCode);

// Delete group (admin/creator only)
router.delete('/group/:id', chatController.deleteGroup);

// Get group members
router.get('/group/:id/members', chatController.getGroupMembers);

// Update message permissions (admin only)
router.put('/group/:id/message-permissions', chatController.updateMessagePermissions);

export default router;

