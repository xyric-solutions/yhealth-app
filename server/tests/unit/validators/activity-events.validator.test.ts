/**
 * Activity Events Validator Unit Tests
 */

import {
  activityEventSchema,
  submitActivityEventsSchema,
  getUserActivityEventsQuerySchema,
} from '../../../src/validators/activity-events.validator.js';

describe('Activity Events Validators', () => {
  describe('activityEventSchema', () => {
    const validEvent = {
      type: 'workout',
      source: 'manual',
      timestamp: '2026-02-16T10:00:00.000Z',
      payload: { duration_minutes: 45 },
    };

    it('should accept valid activity event', () => {
      const result = activityEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('should accept all valid event types', () => {
      const types = ['workout', 'nutrition', 'wellbeing', 'participation'];
      for (const type of types) {
        const result = activityEventSchema.safeParse({ ...validEvent, type });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid source types', () => {
      const sources = ['manual', 'whoop', 'apple_health', 'fitbit', 'garmin', 'oura', 'camera_session', 'integration'];
      for (const source of sources) {
        const result = activityEventSchema.safeParse({ ...validEvent, source });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid event type', () => {
      const result = activityEventSchema.safeParse({
        ...validEvent,
        type: 'sleep',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid source', () => {
      const result = activityEventSchema.safeParse({
        ...validEvent,
        source: 'strava',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-ISO timestamp', () => {
      const result = activityEventSchema.safeParse({
        ...validEvent,
        timestamp: '02/16/2026',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional idempotencyKey', () => {
      const result = activityEventSchema.safeParse({
        ...validEvent,
        idempotencyKey: 'unique-key-123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing type', () => {
      const { type: _type, ...rest } = validEvent;
      const result = activityEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject missing source', () => {
      const { source: _source, ...rest } = validEvent;
      const result = activityEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject missing timestamp', () => {
      const { timestamp: _timestamp, ...rest } = validEvent;
      const result = activityEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should accept empty payload object', () => {
      const result = activityEventSchema.safeParse({
        ...validEvent,
        payload: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe('submitActivityEventsSchema', () => {
    const validEvent = {
      type: 'workout',
      source: 'manual',
      timestamp: '2026-02-16T10:00:00.000Z',
      payload: { duration_minutes: 45 },
    };

    it('should accept array of 1 event', () => {
      const result = submitActivityEventsSchema.safeParse({
        events: [validEvent],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty events array', () => {
      const result = submitActivityEventsSchema.safeParse({
        events: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject more than 100 events', () => {
      const events = Array.from({ length: 101 }, () => validEvent);
      const result = submitActivityEventsSchema.safeParse({ events });
      expect(result.success).toBe(false);
    });

    it('should accept exactly 100 events', () => {
      const events = Array.from({ length: 100 }, () => validEvent);
      const result = submitActivityEventsSchema.safeParse({ events });
      expect(result.success).toBe(true);
    });
  });

  describe('getUserActivityEventsQuerySchema', () => {
    it('should accept all optional filters', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept valid type filter', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({
        type: 'workout',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid type filter', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({
        type: 'sleep',
      });
      expect(result.success).toBe(false);
    });

    it('should transform limit string to number', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({ limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit > 100', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject limit of 0', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({ offset: '-1' });
      expect(result.success).toBe(false);
    });

    it('should accept offset of 0', () => {
      const result = getUserActivityEventsQuerySchema.safeParse({ offset: '0' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });
  });
});
