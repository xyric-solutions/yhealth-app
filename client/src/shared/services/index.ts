/**
 * @file Services barrel export
 * @description Centralized API service layer
 *
 * Usage:
 * import { assessmentService, goalsService } from '@/src/shared/services'
 *
 * // In a component or hook:
 * const response = await assessmentService.selectGoal('weight_loss');
 */

export * from './assessment.service';
export * from './goals.service';
export * from './integrations.service';
export * from './preferences.service';
export * from './plans.service';
export * from './ai-coach.service';
export * from './workouts.service';
export * from './nutrition.service';
export * from './reminder.service';
export * from './rag-chat.service';
export * from './voice-call.service';
export * from './activity-status.service';
export * from './tts.service';
export * from './emotion.service';
export * from './call-summary.service';
export * from './voice-schedule.service';
export * from './chat.service';
export * from './workout-reschedule.service';
export * from './exercises.service';
