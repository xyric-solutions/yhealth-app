import { Router } from 'express';
import { ragChatbotController } from '../controllers/rag-chatbot.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { messagingLimiter } from '../middlewares/rateLimiter.middleware.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  imageBase64: z.string().max(2_000_000).optional(), // Camera frame for multimodal vision coaching
});

const createConversationSchema = z.object({
  title: z.string().max(255).optional(),
  sessionType: z.enum([
    'quick_checkin',
    'coaching_session',
    'emergency_support',
    'goal_review',
    'health_coach',
    'nutrition',
    'fitness',
    'wellness',
  ]).optional(),
});

const updateProfileSchema = z.object({
  section: z.enum(['goals', 'conditions', 'preferences', 'history', 'metrics']),
  content: z.string().min(1).max(5000),
  metadata: z.record(z.unknown()).optional(),
});

const addKnowledgeSchema = z.object({
  category: z.enum(['nutrition', 'exercise', 'sleep', 'mental_health', 'medical', 'general']),
  subcategory: z.string().max(100).optional(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(10000),
  source: z.string().max(255).optional(),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  trustScore: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Chat Routes
// ============================================================================

/**
 * @route   POST /api/rag-chat/message
 * @desc    Send a message and get AI response with RAG context
 * @access  Private
 * @body    { message: string, conversationId?: string }
 */
router.post('/message', authenticate, messagingLimiter, validate(chatMessageSchema), ragChatbotController.chat);

/**
 * @route   POST /api/rag-chat/message/stream
 * @desc    Send a message and get streaming AI response
 * @access  Private
 * @body    { message: string, conversationId?: string }
 */
router.post('/message/stream', authenticate, messagingLimiter, validate(chatMessageSchema), ragChatbotController.chatStream);

// ============================================================================
// Conversation Management Routes
// ============================================================================

/**
 * @route   POST /api/rag-chat/conversations
 * @desc    Create a new conversation
 * @access  Private
 * @body    { title?: string, sessionType?: string }
 */
router.post('/conversations', authenticate, validate(createConversationSchema), ragChatbotController.createConversation);

/**
 * @route   GET /api/rag-chat/conversations
 * @desc    Get user's conversation list
 * @access  Private
 * @query   { limit?: number, status?: string }
 */
router.get('/conversations', authenticate, ragChatbotController.getUserConversations);

/**
 * @route   GET /api/rag-chat/conversations/:conversationId
 * @desc    Get a specific conversation with messages
 * @access  Private
 * @query   { limit?: number }
 */
router.get('/conversations/:conversationId', authenticate, ragChatbotController.getConversation);

/**
 * @route   DELETE /api/rag-chat/conversations/:conversationId
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete('/conversations/:conversationId', authenticate, ragChatbotController.deleteConversation);

/**
 * @route   PATCH /api/rag-chat/conversations/:conversationId/archive
 * @desc    Archive a conversation
 * @access  Private
 */
router.patch('/conversations/:conversationId/archive', authenticate, ragChatbotController.archiveConversation);

/**
 * @route   POST /api/rag-chat/conversations/:conversationId/title
 * @desc    Generate title for a conversation
 * @access  Private
 */
router.post('/conversations/:conversationId/title', authenticate, ragChatbotController.generateTitle);

/**
 * @route   POST /api/rag-chat/conversations/:conversationId/summary
 * @desc    Generate summary for a conversation
 * @access  Private
 */
router.post('/conversations/:conversationId/summary', authenticate, ragChatbotController.generateSummary);

// ============================================================================
// Search Routes
// ============================================================================

/**
 * @route   GET /api/rag-chat/search
 * @desc    Search conversation history
 * @access  Private
 * @query   { q: string, limit?: number }
 */
router.get('/search', authenticate, ragChatbotController.searchHistory);

// ============================================================================
// Health Profile Routes
// ============================================================================

/**
 * @route   POST /api/rag-chat/profile
 * @desc    Update user health profile for RAG context
 * @access  Private
 * @body    { section: string, content: string, metadata?: object }
 */
router.post('/profile', authenticate, validate(updateProfileSchema), ragChatbotController.updateHealthProfile);

// ============================================================================
// Knowledge Base Routes
// ============================================================================

/**
 * @route   POST /api/rag-chat/knowledge
 * @desc    Add knowledge to the health knowledge base (admin only)
 * @access  Private (Admin)
 * @body    { category, subcategory?, title, content, source?, sourceUrl?, tags?, trustScore? }
 */
router.post('/knowledge', authenticate, validate(addKnowledgeSchema), ragChatbotController.addKnowledge);

/**
 * @route   GET /api/rag-chat/knowledge/search
 * @desc    Search knowledge base
 * @access  Private
 * @query   { q: string, category?: string, limit?: number }
 */
router.get('/knowledge/search', authenticate, ragChatbotController.searchKnowledge);

// ============================================================================
// Greeting Route
// ============================================================================

/**
 * @route   GET /api/rag-chat/greeting
 * @desc    Get personalized greeting from AI
 * @access  Private
 */
router.get('/greeting', authenticate, ragChatbotController.getGreeting);

/**
 * @route   GET /api/rag-chat/opening-question
 * @desc    Get opening question to start conversation when user hasn't talked
 * @access  Private
 */
router.get('/opening-question', authenticate, ragChatbotController.getOpeningQuestion);

export default router;
