import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as messageController from '../controllers/message.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Message CRUD
// ============================================

// Send message
router.post('/', messageController.sendMessage);

// Upload media file (must be before /:id routes)
router.post('/upload', messageController.uploadMedia);

// Get messages for a chat (paginated) - must be before /:id route
router.get('/chat/:chatId', messageController.getMessages);

// Mark all messages in chat as read - must be before /:id route
router.post('/chat/:chatId/read-all', messageController.markChatAsRead);

// Get message by ID
router.get('/:id', messageController.getMessageById);

// Edit message
router.put('/:id', messageController.editMessage);

// Delete message
router.delete('/:id', messageController.deleteMessage);

// ============================================
// Message Features
// ============================================

// Add/remove reaction
router.post('/:id/reaction', messageController.addReaction);

// Pin/unpin message
router.post('/:id/pin', messageController.togglePinMessage);

// Star/unstar message
router.post('/:id/star', messageController.toggleStarMessage);

// Forward message
router.post('/:id/forward', messageController.forwardMessage);

// Mark message as read
router.post('/:id/read', messageController.markMessageAsRead);

// Open view-once message (one-time media access)
router.post('/:id/view-once', messageController.openViewOnceMessage);

export default router;

