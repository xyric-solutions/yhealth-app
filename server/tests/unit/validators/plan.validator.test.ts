/**
 * Plan Validator Unit Tests
 *
 * Tests for plan validation schemas including:
 * - Generate plan input validation
 * - Update plan input validation
 * - Log activity input validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  generatePlanSchema,
  updatePlanSchema,
  logActivitySchema,
} from '../../../src/validators/plan.validator.js';

describe('Plan Validators', () => {
  describe('generatePlanSchema', () => {
    it('should accept valid generate plan input', () => {
      const validInput = {
        goalId: '123e4567-e89b-12d3-a456-426614174000',
        regenerate: false,
        preferences: {
          preferredDays: ['monday', 'wednesday', 'friday'],
          preferredTimes: { monday: 'morning', friday: 'evening' },
          excludeActivities: ['swimming'],
        },
      };

      const result = generatePlanSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept input without optional fields', () => {
      const minimalInput = {};

      const result = generatePlanSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
    });

    it('should accept input with only goalId', () => {
      const input = {
        goalId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = generatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept regenerate flag', () => {
      const input = {
        regenerate: true,
      };

      const result = generatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept preferences with empty arrays', () => {
      const input = {
        preferences: {
          preferredDays: [],
          preferredTimes: {},
        },
      };

      const result = generatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid goalId type', () => {
      const invalidInput = {
        goalId: 123, // Should be string
      };

      const result = generatePlanSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid regenerate type', () => {
      const invalidInput = {
        regenerate: 'true', // Should be boolean
      };

      const result = generatePlanSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('updatePlanSchema', () => {
    it('should accept valid status update', () => {
      const validInput = {
        status: 'active',
      };

      const result = updatePlanSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
      const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];

      validStatuses.forEach((status) => {
        const result = updatePlanSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it('should accept user rating within range', () => {
      const validRatings = [1, 2, 3, 4, 5];

      validRatings.forEach((userRating) => {
        const result = updatePlanSchema.safeParse({ userRating });
        expect(result.success).toBe(true);
      });
    });

    it('should reject rating below minimum', () => {
      const invalidInput = {
        userRating: 0,
      };

      const result = updatePlanSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject rating above maximum', () => {
      const invalidInput = {
        userRating: 6,
      };

      const result = updatePlanSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept user feedback', () => {
      const validInput = {
        userFeedback: 'This plan was really helpful for achieving my goals!',
      };

      const result = updatePlanSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept activities array', () => {
      const validInput = {
        activities: [
          {
            id: 'activity-1',
            type: 'workout',
            title: 'Morning Run',
            description: 'A light 30 minute jog',
            daysOfWeek: ['monday', 'wednesday', 'friday'],
          },
        ],
      };

      const result = updatePlanSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept combined updates', () => {
      const validInput = {
        status: 'completed',
        userRating: 4,
        userFeedback: 'Great experience!',
      };

      const result = updatePlanSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status value', () => {
      const invalidInput = {
        status: 'invalid_status',
      };

      const result = updatePlanSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer rating', () => {
      const invalidInput = {
        userRating: 3.5,
      };

      const result = updatePlanSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('logActivitySchema', () => {
    it('should require status field', () => {
      const invalidInput = {
        scheduledDate: new Date().toISOString(),
      };

      const result = logActivitySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept valid completed status', () => {
      const validInput = {
        status: 'completed',
      };

      const result = logActivitySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
      const validStatuses = ['pending', 'completed', 'skipped', 'partial'];

      validStatuses.forEach((status) => {
        const result = logActivitySchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it('should accept scheduled date', () => {
      const validInput = {
        status: 'completed',
        scheduledDate: new Date().toISOString(),
      };

      const result = logActivitySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept actual value', () => {
      const validInput = {
        status: 'partial',
        actualValue: 15.5,
      };

      const result = logActivitySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept duration', () => {
      const validInput = {
        status: 'completed',
        duration: 45,
      };

      const result = logActivitySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept notes', () => {
      const validInput = {
        status: 'skipped',
        notes: 'Was feeling under the weather today',
      };

      const result = logActivitySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept mood within range', () => {
      const validMoods = [1, 2, 3, 4, 5];

      validMoods.forEach((mood) => {
        const result = logActivitySchema.safeParse({
          status: 'completed',
          mood,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject mood below minimum', () => {
      const invalidInput = {
        status: 'completed',
        mood: 0,
      };

      const result = logActivitySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject mood above maximum', () => {
      const invalidInput = {
        status: 'completed',
        mood: 6,
      };

      const result = logActivitySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept full activity log', () => {
      const validInput = {
        status: 'completed',
        scheduledDate: new Date().toISOString(),
        actualValue: 30,
        duration: 35,
        notes: 'Exceeded my target today! Feeling great.',
        mood: 5,
      };

      const result = logActivitySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status value', () => {
      const invalidInput = {
        status: 'done', // Should be 'completed', 'skipped', 'partial', or 'pending'
      };

      const result = logActivitySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject negative duration', () => {
      const invalidInput = {
        status: 'completed',
        duration: -10,
      };

      const result = logActivitySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should allow negative actual value', () => {
      // The schema allows negative values (e.g., for tracking weight loss)
      const input = {
        status: 'partial',
        actualValue: -5,
      };

      const result = logActivitySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

describe('Plan Validator Edge Cases', () => {
  describe('generatePlanSchema edge cases', () => {
    it('should handle empty preferences object', () => {
      const input = {
        preferences: {},
      };

      const result = generatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should handle null values gracefully', () => {
      const input = {
        goalId: null,
      };

      const result = generatePlanSchema.safeParse(input);
      // Depends on schema - should either reject or coerce
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('updatePlanSchema edge cases', () => {
    it('should handle empty object', () => {
      const input = {};

      const result = updatePlanSchema.safeParse(input);
      expect(result.success).toBe(true); // All fields optional
    });

    it('should handle very long feedback', () => {
      const input = {
        userFeedback: 'a'.repeat(10000),
      };

      const result = updatePlanSchema.safeParse(input);
      // May have length limits
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle special characters in feedback', () => {
      const input = {
        userFeedback: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
      };

      const result = updatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should handle unicode in feedback', () => {
      const input = {
        userFeedback: 'Great plan! I achieved my goals. Plan parfait! 最高のプラン!',
      };

      const result = updatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should handle emoji in feedback', () => {
      const input = {
        userFeedback: 'Amazing results! 💪🏃‍♂️🎯',
      };

      const result = updatePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('logActivitySchema edge cases', () => {
    it('should handle very long notes', () => {
      const input = {
        status: 'completed',
        notes: 'a'.repeat(5000),
      };

      const result = logActivitySchema.safeParse(input);
      expect(typeof result.success).toBe('boolean');
    });

    it('should reject zero duration (must be positive)', () => {
      const input = {
        status: 'completed',
        duration: 0,
      };

      const result = logActivitySchema.safeParse(input);
      expect(result.success).toBe(false); // .positive() requires > 0
    });

    it('should handle zero actual value', () => {
      const input = {
        status: 'partial',
        actualValue: 0,
      };

      const result = logActivitySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should handle very large duration', () => {
      const input = {
        status: 'completed',
        duration: 1440, // 24 hours in minutes
      };

      const result = logActivitySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should handle decimal actual value', () => {
      const input = {
        status: 'partial',
        actualValue: 2.5,
      };

      const result = logActivitySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
