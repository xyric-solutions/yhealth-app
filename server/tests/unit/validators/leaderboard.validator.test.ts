/**
 * Leaderboard Validator Unit Tests
 */

import {
  getLeaderboardQuerySchema,
  getAroundMeQuerySchema,
} from '../../../src/validators/leaderboard.validator.js';

describe('Leaderboard Validators', () => {
  describe('getLeaderboardQuerySchema', () => {
    it('should accept valid query with all fields', () => {
      const result = getLeaderboardQuerySchema.safeParse({
        date: '2026-02-16',
        type: 'global',
        segment: 'US',
        limit: '50',
        offset: '0',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query (all optional)', () => {
      const result = getLeaderboardQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = getLeaderboardQuerySchema.safeParse({
        date: '02-16-2026',
      });
      expect(result.success).toBe(false);
    });

    it('should reject date without leading zeros', () => {
      const result = getLeaderboardQuerySchema.safeParse({
        date: '2026-2-16',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid leaderboard types', () => {
      const types = ['global', 'country', 'friends', 'competition'];
      for (const type of types) {
        const result = getLeaderboardQuerySchema.safeParse({ type });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid leaderboard type', () => {
      const result = getLeaderboardQuerySchema.safeParse({
        type: 'team',
      });
      expect(result.success).toBe(false);
    });

    it('should transform limit string to number', () => {
      const result = getLeaderboardQuerySchema.safeParse({ limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit > 1000', () => {
      const result = getLeaderboardQuerySchema.safeParse({ limit: '1001' });
      expect(result.success).toBe(false);
    });

    it('should reject limit of 0', () => {
      const result = getLeaderboardQuerySchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric limit', () => {
      const result = getLeaderboardQuerySchema.safeParse({ limit: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = getLeaderboardQuerySchema.safeParse({ offset: '-1' });
      expect(result.success).toBe(false);
    });

    it('should accept offset of 0', () => {
      const result = getLeaderboardQuerySchema.safeParse({ offset: '0' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('getAroundMeQuerySchema', () => {
    it('should accept valid date and range', () => {
      const result = getAroundMeQuerySchema.safeParse({
        date: '2026-02-16',
        range: '50',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query (all optional)', () => {
      const result = getAroundMeQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject range > 100', () => {
      const result = getAroundMeQuerySchema.safeParse({ range: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject range < 1', () => {
      const result = getAroundMeQuerySchema.safeParse({ range: '0' });
      expect(result.success).toBe(false);
    });

    it('should transform range string to number', () => {
      const result = getAroundMeQuerySchema.safeParse({ range: '25' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.range).toBe(25);
      }
    });

    it('should reject invalid date format', () => {
      const result = getAroundMeQuerySchema.safeParse({
        date: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });
});
