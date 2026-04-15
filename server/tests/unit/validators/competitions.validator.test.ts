/**
 * Competitions Validator Unit Tests
 */

import {
  competitionRulesSchema,
  competitionEligibilitySchema,
  createCompetitionSchema,
} from '../../../src/validators/competitions.validator.js';

describe('Competitions Validators', () => {
  describe('competitionRulesSchema', () => {
    it('should accept valid rules with all fields', () => {
      const result = competitionRulesSchema.safeParse({
        metric: 'total',
        aggregation: 'total',
        target: 1000,
        min_days: 7,
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid metrics', () => {
      const metrics = ['workout', 'nutrition', 'wellbeing', 'participation', 'total'];
      for (const metric of metrics) {
        const result = competitionRulesSchema.safeParse({
          metric,
          aggregation: 'total',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid aggregation types', () => {
      const aggregations = ['streak', 'total', 'average', 'max'];
      for (const aggregation of aggregations) {
        const result = competitionRulesSchema.safeParse({
          metric: 'total',
          aggregation,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept optional target and min_days', () => {
      const result = competitionRulesSchema.safeParse({
        metric: 'workout',
        aggregation: 'streak',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid metric', () => {
      const result = competitionRulesSchema.safeParse({
        metric: 'sleep',
        aggregation: 'total',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid aggregation', () => {
      const result = competitionRulesSchema.safeParse({
        metric: 'total',
        aggregation: 'median',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing metric', () => {
      const result = competitionRulesSchema.safeParse({
        aggregation: 'total',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing aggregation', () => {
      const result = competitionRulesSchema.safeParse({
        metric: 'total',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('competitionEligibilitySchema', () => {
    it('should accept empty object', () => {
      const result = competitionEligibilitySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept all optional arrays', () => {
      const result = competitionEligibilitySchema.safeParse({
        regions: ['US', 'UK'],
        subscription_tiers: ['premium'],
        age_brackets: ['18-25'],
        groups: ['fitness-enthusiasts'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty arrays', () => {
      const result = competitionEligibilitySchema.safeParse({
        regions: [],
        subscription_tiers: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createCompetitionSchema', () => {
    const validCompetition = {
      name: 'February Fitness Challenge',
      type: 'admin_created',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
      rules: {
        metric: 'total',
        aggregation: 'total',
      },
    };

    it('should accept valid competition data', () => {
      const result = createCompetitionSchema.safeParse(validCompetition);
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const { name: _name, ...rest } = validCompetition;
      const result = createCompetitionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name > 255 chars', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        name: 'A'.repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it('should accept name of exactly 255 chars', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        name: 'A'.repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid competition types', () => {
      const types = ['ai_generated', 'admin_created'];
      for (const type of types) {
        const result = createCompetitionSchema.safeParse({
          ...validCompetition,
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid competition type', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        type: 'user_created',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional description', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        description: 'A great challenge for everyone',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional eligibility', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        eligibility: { regions: ['US'] },
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional scoringWeights', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        scoringWeights: { workout: 0.5, nutrition: 0.5 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional antiCheatPolicy and prizeMetadata', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        antiCheatPolicy: { max_daily_events: 50 },
        prizeMetadata: { first_place: 'Badge' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing startDate', () => {
      const { startDate: _startDate, ...rest } = validCompetition;
      const result = createCompetitionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject non-ISO startDate', () => {
      const result = createCompetitionSchema.safeParse({
        ...validCompetition,
        startDate: 'Feb 1, 2026',
      });
      expect(result.success).toBe(false);
    });
  });
});
