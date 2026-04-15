import { z } from 'zod';

// Goal categories (shared with assessment)
const goalCategoryEnum = z.enum([
  'weight_loss',
  'muscle_building',
  'sleep_improvement',
  'stress_wellness',
  'energy_productivity',
  'event_training',
  'health_condition',
  'habit_building',
  'overall_optimization',
  'nutrition',
  'fitness',
  'custom',
]);

// Supported languages
const supportedLanguageEnum = z.enum(['en', 'ur']);

// Assessment response input for goal generation
const assessmentResponseInputSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()),
  ]),
});

// Body stats input for goal generation
const bodyStatsInputSchema = z.object({
  heightCm: z.number().min(50).max(300).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  targetWeightKg: z.number().min(20).max(500).optional(),
  bodyFatPercentage: z.number().min(1).max(70).optional(),
  age: z.number().int().min(13).max(120).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
});

// Chat message schema
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

// Extracted insight schema
const extractedInsightSchema = z.object({
  category: z.enum(['motivation', 'barrier', 'preference', 'lifestyle', 'goal', 'health_status']),
  text: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

// Start conversation schema
export const startConversationSchema = z.object({
  goal: goalCategoryEnum,
  userName: z.string().max(100).optional(),
  language: supportedLanguageEnum.optional(),
});

// Send message schema
export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long (max 2000 characters)'),
  goal: goalCategoryEnum,
  conversationHistory: z.array(chatMessageSchema),
  messageCount: z.number().int().min(0).optional(),
  extractedInsights: z.array(extractedInsightSchema).optional(),
  language: supportedLanguageEnum.optional(),
});

// Complete assessment schema
export const completeAssessmentSchema = z.object({
  goal: goalCategoryEnum,
  conversationHistory: z.array(chatMessageSchema).min(1, 'Conversation history is required'),
  extractedInsights: z.array(extractedInsightSchema),
});

// Generate goals schema
export const generateGoalsSchema = z.object({
  goalCategory: goalCategoryEnum,
  assessmentResponses: z.array(assessmentResponseInputSchema).default([]),
  bodyStats: bodyStatsInputSchema.default({}),
  customGoalText: z.string().max(500).optional(),
});

// Get/create session schema
export const sessionSchema = z.object({
  goal: goalCategoryEnum,
  sessionType: z.string().max(50).optional(),
});

// Chat schema (with session persistence)
export const chatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
  goal: goalCategoryEnum,
});

// Diet plan generation schema
export const generateDietPlanSchema = z.object({
  goal: goalCategoryEnum,
  extractedInsights: z.array(extractedInsightSchema).default([]),
  preferences: z.object({
    dietaryRestrictions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    cuisinePreferences: z.array(z.string()).optional(),
    mealsPerDay: z.number().int().min(1).max(6).optional(),
    budget: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
});

// Image analysis schemas
export const analyzeImageSchema = z.object({
  question: z.string().max(500).optional(),
  goal: goalCategoryEnum.optional(),
});

export const chatWithImageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().max(2000).optional(),
  goal: goalCategoryEnum,
});

// Types
export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CompleteAssessmentInput = z.infer<typeof completeAssessmentSchema>;
export type GenerateGoalsInput = z.infer<typeof generateGoalsSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
export type GenerateDietPlanInput = z.infer<typeof generateDietPlanSchema>;
export type AnalyzeImageInput = z.infer<typeof analyzeImageSchema>;
export type ChatWithImageInput = z.infer<typeof chatWithImageSchema>;
