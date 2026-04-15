/**
 * @file Competition Chat Routes
 * @description API endpoints for competition live chat.
 *
 * Mount point: /api/v1/competitions  (and /api/competitions alias)
 *
 * Endpoints:
 *   GET    /:competitionId/chat                          - Get messages (paginated)
 *   POST   /:competitionId/chat                          - Send message
 *   POST   /:competitionId/chat/:messageId/reactions     - Add reaction
 *   DELETE /:competitionId/chat/:messageId/reactions/:emoji - Remove reaction
 *   DELETE /:competitionId/chat/:messageId               - Delete own message
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import {
  sendMessage,
  getMessages,
  addReaction,
  removeReaction,
  deleteMessage,
} from '../controllers/competition-chat.controller.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// GET /api/v1/competitions/:competitionId/chat - Get messages
router.get('/:competitionId/chat', getMessages);

// POST /api/v1/competitions/:competitionId/chat - Send message
router.post('/:competitionId/chat', sendMessage);

// POST /api/v1/competitions/:competitionId/chat/:messageId/reactions - Add reaction
router.post('/:competitionId/chat/:messageId/reactions', addReaction);

// DELETE /api/v1/competitions/:competitionId/chat/:messageId/reactions/:emoji - Remove reaction
router.delete('/:competitionId/chat/:messageId/reactions/:emoji', removeReaction);

// DELETE /api/v1/competitions/:competitionId/chat/:messageId - Delete message
router.delete('/:competitionId/chat/:messageId', deleteMessage);

export default router;
