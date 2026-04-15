import { Router } from 'express';
import { aiCoachController } from '../controllers/ai-coach.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { aiGenerationLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  startConversationSchema,
  sendMessageSchema,
  completeAssessmentSchema,
  generateGoalsSchema,
  sessionSchema,
  chatSchema,
  generateDietPlanSchema,
} from '../validators/ai-coach.validator.js';

const router = Router();

/**
 * @route   GET /api/ai-coach/status
 * @desc    Check if AI Coach is available
 * @access  Public
 */
router.get('/status', aiCoachController.getStatus);

/**
 * @route   POST /api/ai-coach/start
 * @desc    Start a new AI coach conversation
 * @access  Private
 * @body    { goal: GoalCategory, userName?: string }
 */
router.post('/start', authenticate, validate(startConversationSchema), aiCoachController.startConversation);

/**
 * @route   POST /api/ai-coach/message
 * @desc    Send a message and get AI response
 * @access  Private
 * @body    {
 *            message: string,
 *            goal: GoalCategory,
 *            conversationHistory: ChatMessage[],
 *            messageCount: number,
 *            extractedInsights?: ExtractedInsight[]
 *          }
 */
router.post('/message', authenticate, validate(sendMessageSchema), aiCoachController.sendMessage);

/**
 * @route   POST /api/ai-coach/complete
 * @desc    Complete the assessment and get summary
 * @access  Private
 * @body    {
 *            goal: GoalCategory,
 *            conversationHistory: ChatMessage[],
 *            extractedInsights: ExtractedInsight[]
 *          }
 */
router.post('/complete', authenticate, validate(completeAssessmentSchema), aiCoachController.completeAssessment);

// ============================================================================
// Session Management (Chat History Persistence)
// ============================================================================

/**
 * @route   POST /api/ai-coach/session
 * @desc    Get or create an active session
 * @access  Private
 * @body    { goal: GoalCategory, sessionType?: string }
 */
router.post('/session', authenticate, validate(sessionSchema), aiCoachController.getOrCreateSession);

/**
 * @route   GET /api/ai-coach/session/:sessionId
 * @desc    Get a specific session with full messages
 * @access  Private
 */
router.get('/session/:sessionId', authenticate, aiCoachController.getSession);

/**
 * @route   GET /api/ai-coach/session/:sessionId/pdf
 * @desc    Download session as PDF
 * @access  Private
 */
router.get('/session/:sessionId/pdf', authenticate, aiCoachController.downloadSessionPDF);

/**
 * @route   DELETE /api/ai-coach/session/:sessionId
 * @desc    Delete a chat session
 * @access  Private
 */
router.delete('/session/:sessionId', authenticate, aiCoachController.deleteSession);

/**
 * @route   GET /api/ai-coach/history
 * @desc    Get previous chat sessions
 * @access  Private
 * @query   { limit?: number }
 */
router.get('/history', authenticate, aiCoachController.getChatHistory);

/**
 * @route   POST /api/ai-coach/chat
 * @desc    Send message with automatic session persistence
 * @access  Private
 * @body    { sessionId?: string, message: string, goal: GoalCategory }
 */
router.post('/chat', authenticate, validate(chatSchema), aiCoachController.chat);

// ============================================================================
// Goal Generation
// ============================================================================

/**
 * @route   POST /api/ai-coach/generate-goals
 * @desc    Generate personalized SMART goals based on assessment
 * @access  Private
 * @body    {
 *            goalCategory: GoalCategory,
 *            assessmentResponses: AssessmentResponseInput[],
 *            bodyStats: BodyStatsInput,
 *            customGoalText?: string
 *          }
 */
router.post('/generate-goals', authenticate, aiGenerationLimiter, validate(generateGoalsSchema), aiCoachController.generateGoals);

// ============================================================================
// MCQ Dynamic Question Generation
// ============================================================================

/**
 * @route   POST /api/ai-coach/mcq/question
 * @desc    Generate next MCQ question dynamically
 * @access  Private
 * @body    {
 *            goal: GoalCategory,
 *            phase?: ConversationPhase,
 *            previousAnswers?: { questionId: string, selectedOptions: string[] }[],
 *            extractedInsights?: ExtractedInsight[],
 *            language?: SupportedLanguage
 *          }
 */
router.post('/mcq/question', authenticate, aiCoachController.generateMCQQuestion);

/**
 * @route   POST /api/ai-coach/mcq/answer
 * @desc    Process MCQ answer and extract insights
 * @access  Private
 * @body    {
 *            questionId: string,
 *            selectedOptions: MCQOption[],
 *            goal: GoalCategory
 *          }
 */
router.post('/mcq/answer', authenticate, aiCoachController.processMCQAnswer);

// ============================================================================
// Diet Plan Generation
// ============================================================================

/**
 * @route   POST /api/ai-coach/diet-plan/generate
 * @desc    Generate a personalized diet plan
 * @access  Private
 * @body    { goal: GoalCategory, extractedInsights: ExtractedInsight[], preferences?: {...} }
 */
router.post('/diet-plan/generate', authenticate, validate(generateDietPlanSchema), aiCoachController.generateDietPlan);

/**
 * @route   GET /api/ai-coach/diet-plan
 * @desc    Get active diet plan
 * @access  Private
 */
router.get('/diet-plan', authenticate, aiCoachController.getDietPlan);

// ============================================================================
// Image Analysis (Health Images Only)
// ============================================================================

/**
 * @route   POST /api/ai-coach/image/analyze
 * @desc    Upload and analyze a health image (body, xray, report, food, fitness)
 * @access  Private
 * @body    FormData with 'image' file, optional 'question' and 'goal'
 */
router.post('/image/analyze', authenticate, uploadImage, aiCoachController.analyzeImage);

/**
 * @route   POST /api/ai-coach/image/validate
 * @desc    Validate if image is health-related (lighter endpoint)
 * @access  Private
 * @body    FormData with 'image' file
 */
router.post('/image/validate', authenticate, uploadImage, aiCoachController.validateImage);

/**
 * @route   POST /api/ai-coach/chat-with-image
 * @desc    Send chat message with image attachment
 * @access  Private
 * @body    FormData with 'image' file, 'goal', optional 'message' and 'sessionId'
 */
router.post('/chat-with-image', authenticate, uploadImage, aiCoachController.chatWithImage);

// ============================================================================
// Coaching Profile
// ============================================================================

/**
 * @route   GET /api/ai-coach/profile
 * @desc    Get user's AI coaching profile with insights, adherence, predictions
 * @access  Private
 */
router.get('/profile', authenticate, aiCoachController.getCoachingProfile);

/**
 * @route   POST /api/ai-coach/profile/refresh
 * @desc    Force regenerate the coaching profile
 * @access  Private
 */
router.post('/profile/refresh', authenticate, aiCoachController.refreshCoachingProfile);

/**
 * @route   PATCH /api/ai-coach/profile/tone
 * @desc    Update coaching tone preference
 * @access  Private
 * @body    { tone: 'supportive' | 'direct' | 'tough_love' }
 */
router.patch('/profile/tone', authenticate, aiCoachController.updateCoachingTone);

export default router;
