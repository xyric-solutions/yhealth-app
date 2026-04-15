export { logger } from "./logger.service.js";
export { cache, cacheKeys } from "./cache.service.js";
export { emailService } from "./email.service.js";
export { socketService } from "./socket.service.js";
export { smsService } from "./sms.service.js";
export { oauthService } from "./oauth.service.js";
export { r2Service } from "./r2.service.js";
export { aiCoachService } from "./ai-coach.service.js";
export type {
  GoalCategory,
  ConversationPhase,
  SupportedLanguage,
  ChatMessage,
  ConversationContext,
  ExtractedInsight,
  AICoachResponse,
  AICoachSession,
  DietPlanRequest,
  GeneratedDietPlan,
  HealthImageType,
  ImageValidationResult,
  ImageAnalysisResult,
  UploadedHealthImage,
  // Goal Generation
  AssessmentResponseInput,
  BodyStatsInput,
  GenerateGoalsRequest,
  GeneratedGoal,
  GenerateGoalsResponse,
  // MCQ Generation
  MCQCategory,
  MCQOption,
  MCQQuestion,
  MCQGenerationRequest,
  MCQGenerationResponse,
} from "./ai-coach.service.js";

export { nutritionService } from "./nutrition.service.js";
export type {
  Gender,
  ActivityLevel,
  GoalType,
  UserMetrics,
  GoalParameters,
  TDEEResult,
  MacroResult,
  NutritionPlan,
} from "./nutrition.service.js";

export { safetyService } from "./safety.service.js";
export type {
  RiskLevel,
  MedicalCondition,
  UserHealthData,
  GoalSafetyCheck,
  SafetyValidationResult,
  SafetyWarning,
} from "./safety.service.js";

export { onboardingAIService } from "./onboarding-ai.service.js";
export type {
  OnboardingData,
  GeneratedDietPlan as OnboardingDietPlan,
  GeneratedWorkoutPlan as OnboardingWorkoutPlan,
  OnboardingAnalysisResult,
} from "./onboarding-ai.service.js";

export { voiceCallService } from "./voice-call.service.js";
export type {
  VoiceCall,
  CallStatus,
  CallChannel,
  CallInitiationRequest,
  CallInitiationResponse,
  CallStatusResponse,
  CallHistoryFilters,
  CallHistoryResponse,
  CallSummary,
} from "../types/voice-call.types.js";

export { activityStatusService } from "./activity-status.service.js";
export type {
  ActivityStatus,
  ActivityStatusHistory,
  ActivityStatusConfig,
  CurrentStatusResponse,
  SetStatusRequest,
  CalendarMonthResponse,
  StatusHistoryResponse,
  StatusStats,
} from "../types/activity-status.types.js";

export { elevenlabsService } from "./elevenlabs.service.js";
export type {
  ElevenLabsTTSOptions,
} from "./elevenlabs.service.js";

export { emotionDetectionService } from "./emotion-detection.service.js";
export type {
  EmotionCategory,
  EmotionDetection,
  ConversationContext as EmotionConversationContext,
  EmotionTrend,
} from "./emotion-detection.service.js";

export { crisisDetectionService } from "./crisis-detection.service.js";
export type {
  CrisisDetection,
  DistressLevel,
  CrisisResources,
} from "./crisis-detection.service.js";

export { mentalRecoveryScoreService } from "./mental-recovery-score.service.js";
export type {
  RecoveryScore,
  RecoveryTrend,
} from "./mental-recovery-score.service.js";

export { sessionOrchestrationService } from "./session-orchestration.service.js";
export type {
  SessionType,
  SessionContext,
  SessionSuggestion,
} from "./session-orchestration.service.js";

export { voiceSessionService } from "./voice-session.service.js";
export type {
  SessionPhase,
  VoiceSession,
  TimingStatus,
} from "./voice-session.service.js";

export { reportGenerationService } from "./report-generation.service.js";
export type {
  ReportPeriod,
  ReportSummary,
  WeeklyReport,
  CategoryPerformance,
  GoalProgress,
  Recommendation,
  HealthTrend,
  ComprehensiveReport,
} from "./report-generation.service.js";

export { assemblyAIService } from "./assemblyai.service.js";
export type {
  TranscriptionOptions,
  TranscriptionResult,
} from "./assemblyai.service.js";