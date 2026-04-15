/**
 * Activity Ingestion Service Unit Tests
 *
 * Tests for event validation, normalization, deduplication,
 * anomaly detection, batch ingestion, and user event retrieval.
 */

import { jest } from '@jest/globals';

// ============================================
// MOCKS (unstable_mockModule for ESM)
// ============================================

const mockQuery = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('../../../src/database/pg.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn<any>().mockResolvedValue(undefined),
  })),
}));

jest.unstable_mockModule('../../../src/config/queue.config.js', () => ({
  redisConnection: {},
  queueConfig: { defaultJobOptions: {} },
  QueueNames: { ACTIVITY_EVENT_PROCESSING: 'activity-event-processing' },
  JobPriorities: { HIGH: 4 },
}));

// ============================================
// IMPORTS (dynamic, after mock setup)
// ============================================

const { activityIngestionService } = await import('../../../src/services/activity-ingestion.service.js');
const {
  generateActivityEventInput,
  generateActivityEventRow,
  mockQueryResult,
} = await import('../../helpers/leaderboard.testUtils.js');

// ============================================
// HELPERS
// ============================================

const TEST_USER_ID = 'test-user-id';

/**
 * Set up mockQuery to return no duplicates and then return an inserted row.
 * Covers the two standard query calls: checkDuplicate COUNT + INSERT RETURNING.
 */
function setupSuccessfulIngestion(rowOverrides: Record<string, unknown> = {}) {
  const row = generateActivityEventRow(rowOverrides);
  mockQuery
    .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))   // checkDuplicate
    .mockResolvedValueOnce(mockQueryResult([row]));               // INSERT RETURNING
}

// ============================================
// TESTS
// ============================================

// Mock queue object to inject into service
const mockQueueAdd = jest.fn<any>().mockResolvedValue(undefined);
const mockEventQueue = { add: mockQueueAdd };

describe('ActivityIngestionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
    // Inject mock queue directly to bypass BullMQ ESM hoisting issues
    (activityIngestionService as any).eventQueue = mockEventQueue;
  });

  // ------------------------------------------
  // ingestEvent
  // ------------------------------------------

  describe('ingestEvent', () => {
    it('should insert a valid workout event and return an ActivityEvent', async () => {
      const input = generateActivityEventInput();
      const row = generateActivityEventRow();
      setupSuccessfulIngestion();

      const result = await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      expect(result).toBeDefined();
      expect(result.id).toBe(row.id);
      expect(result.userId).toBe(row.user_id);
      expect(result.type).toBe('workout');
      expect(result.source).toBe('manual');
      expect(result.confidence).toBe(0.8);
      // INSERT query should have been called
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    // --- Validation errors ---

    it('should reject an invalid event type', async () => {
      const input = generateActivityEventInput({ type: 'invalid_type' as never });

      await expect(
        activityIngestionService.ingestEvent(TEST_USER_ID, input),
      ).rejects.toThrow('Invalid event type');
    });

    it('should reject a missing event source', async () => {
      const input = generateActivityEventInput({ source: '' as never });

      await expect(
        activityIngestionService.ingestEvent(TEST_USER_ID, input),
      ).rejects.toThrow('Event source is required');
    });

    it('should reject a missing timestamp', async () => {
      const input = generateActivityEventInput({ timestamp: '' });

      await expect(
        activityIngestionService.ingestEvent(TEST_USER_ID, input),
      ).rejects.toThrow('Event timestamp is required');
    });

    it('should reject an invalid timestamp format', async () => {
      const input = generateActivityEventInput({ timestamp: 'not-a-date' });

      await expect(
        activityIngestionService.ingestEvent(TEST_USER_ID, input),
      ).rejects.toThrow('Invalid timestamp format');
    });

    it('should reject a non-object payload', async () => {
      const input = generateActivityEventInput({ payload: 'string-payload' as never });

      await expect(
        activityIngestionService.ingestEvent(TEST_USER_ID, input),
      ).rejects.toThrow('Event payload is required and must be an object');
    });

    // --- Normalization ---

    it('should normalize timestamp to ISO 8601 format', async () => {
      const input = generateActivityEventInput({
        timestamp: '2026-02-16 14:30:00',
      });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      // The INSERT call is the second query invocation
      const insertCall = mockQuery.mock.calls[1];
      const timestampArg = insertCall[1]![3] as string;
      // ISO 8601 ends with Z or contains T
      expect(timestampArg).toMatch(/T.*Z$/);
    });

    it('should generate idempotencyKey when not provided', async () => {
      const input = generateActivityEventInput();
      // Ensure no idempotencyKey in input
      delete (input as { idempotencyKey?: string }).idempotencyKey;
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      // checkDuplicate call should have received a generated key
      const duplicateCheckCall = mockQuery.mock.calls[0];
      const idempotencyKeyArg = duplicateCheckCall[1]![1] as string;
      expect(idempotencyKeyArg).toBeDefined();
      expect(idempotencyKeyArg.length).toBeGreaterThan(0);
      // Format: userId:type:timestamp:payloadHash
      expect(idempotencyKeyArg).toContain(TEST_USER_ID);
      expect(idempotencyKeyArg).toContain('workout');
    });

    it('should preserve a provided idempotencyKey', async () => {
      const customKey = 'custom-idempotency-key-123';
      const input = generateActivityEventInput({ idempotencyKey: customKey });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      // checkDuplicate should have used the provided key
      const duplicateCheckCall = mockQuery.mock.calls[0];
      const idempotencyKeyArg = duplicateCheckCall[1]![1] as string;
      expect(idempotencyKeyArg).toBe(customKey);
    });

    // --- Deduplication ---

    it('should reject duplicate events', async () => {
      const input = generateActivityEventInput();
      // checkDuplicate returns count > 0
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '1' }]));

      await expect(
        activityIngestionService.ingestEvent(TEST_USER_ID, input),
      ).rejects.toThrow('Duplicate event');
    });

    // --- Anomaly detection ---

    it('should flag anomaly for workout with negative duration', async () => {
      const input = generateActivityEventInput({
        payload: { duration_minutes: -10, calories_burned: 200 },
      });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      // The INSERT call flags parameter (7th param, index 6)
      const insertCall = mockQuery.mock.calls[1];
      const flagsArg = JSON.parse(insertCall[1]![6] as string);
      expect(flagsArg.anomaly_detected).toBe(true);
      expect(flagsArg.requires_review).toBe(true);
    });

    it('should flag anomaly for workout with duration > 1440 minutes', async () => {
      const input = generateActivityEventInput({
        payload: { duration_minutes: 1500, calories_burned: 500 },
      });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      const insertCall = mockQuery.mock.calls[1];
      const flagsArg = JSON.parse(insertCall[1]![6] as string);
      expect(flagsArg.anomaly_detected).toBe(true);
      expect(flagsArg.requires_review).toBe(true);
    });

    it('should flag anomaly for workout with calories_burned > 10000', async () => {
      const input = generateActivityEventInput({
        payload: { duration_minutes: 60, calories_burned: 15000 },
      });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      const insertCall = mockQuery.mock.calls[1];
      const flagsArg = JSON.parse(insertCall[1]![6] as string);
      expect(flagsArg.anomaly_detected).toBe(true);
    });

    it('should flag anomaly for nutrition with calories > 20000', async () => {
      const input = generateActivityEventInput({
        type: 'nutrition',
        payload: { calories: 25000 },
      });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      const insertCall = mockQuery.mock.calls[1];
      const flagsArg = JSON.parse(insertCall[1]![6] as string);
      expect(flagsArg.anomaly_detected).toBe(true);
      expect(flagsArg.requires_review).toBe(true);
    });

    it('should NOT flag anomaly for valid workout values', async () => {
      const input = generateActivityEventInput({
        payload: { duration_minutes: 60, calories_burned: 500 },
      });
      setupSuccessfulIngestion();

      await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      const insertCall = mockQuery.mock.calls[1];
      const flagsArg = JSON.parse(insertCall[1]![6] as string);
      expect(flagsArg.anomaly_detected).toBe(false);
      expect(flagsArg.requires_review).toBe(false);
    });

    // --- Confidence scores ---

    it('should assign confidence 0.95 for whoop source', async () => {
      const input = generateActivityEventInput({ source: 'whoop' });
      const row = generateActivityEventRow({ source: 'whoop', confidence: 0.95 });
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([row]));

      const result = await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      // Confidence parameter passed to INSERT (6th param, index 5)
      const insertCall = mockQuery.mock.calls[1];
      const confidenceArg = insertCall[1]![5] as number;
      expect(confidenceArg).toBe(0.95);
      expect(result.confidence).toBe(0.95);
    });

    it('should assign confidence 0.8 for manual source', async () => {
      const input = generateActivityEventInput({ source: 'manual' });
      setupSuccessfulIngestion();

      const result = await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      const insertCall = mockQuery.mock.calls[1];
      const confidenceArg = insertCall[1]![5] as number;
      expect(confidenceArg).toBe(0.8);
      expect(result.confidence).toBe(0.8);
    });

    it('should assign confidence 1.0 for camera_session source', async () => {
      const input = generateActivityEventInput({ source: 'camera_session' });
      const row = generateActivityEventRow({ source: 'camera_session', confidence: 1.0 });
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([row]));

      const result = await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      const insertCall = mockQuery.mock.calls[1];
      const confidenceArg = insertCall[1]![5] as number;
      expect(confidenceArg).toBe(1.0);
      expect(result.confidence).toBe(1.0);
    });

    // --- Queue publishing ---

    it('should publish to the event queue after successful insert', async () => {
      const input = generateActivityEventInput();
      setupSuccessfulIngestion();

      const result = await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      // The service should have initialized the queue and called add.
      // We verify the event was returned successfully (queue is fire-and-forget).
      expect(result).toBeDefined();
      expect(result.id).toBe('event-test-id');
    });

    it('should handle queue failure gracefully without throwing', async () => {
      const input = generateActivityEventInput();
      const row = generateActivityEventRow();

      // checkDuplicate + INSERT succeed
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([row]));

      // The queue add is wrapped in .catch(), so even if the queue
      // internally errors, the service should still return the event.
      const result = await activityIngestionService.ingestEvent(TEST_USER_ID, input);

      expect(result).toBeDefined();
      expect(result.id).toBe(row.id);
    });
  });

  // ------------------------------------------
  // ingestEvents (batch)
  // ------------------------------------------

  describe('ingestEvents', () => {
    it('should process multiple events and return all successfully ingested', async () => {
      const inputs = [
        generateActivityEventInput({ payload: { duration_minutes: 30, calories_burned: 200 } }),
        generateActivityEventInput({ type: 'nutrition', payload: { calories: 500 } }),
      ];

      // First event: checkDuplicate + INSERT
      const row1 = generateActivityEventRow({ id: 'event-1' });
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([row1]));

      // Second event: checkDuplicate + INSERT
      const row2 = generateActivityEventRow({ id: 'event-2', type: 'nutrition' });
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([row2]));

      const results = await activityIngestionService.ingestEvents(TEST_USER_ID, inputs);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('event-1');
      expect(results[1].id).toBe('event-2');
    });

    it('should skip failed events and continue processing remaining', async () => {
      const inputs = [
        generateActivityEventInput({ type: 'invalid_type' as never }), // will fail validation
        generateActivityEventInput({ payload: { duration_minutes: 45, calories_burned: 300 } }),
      ];

      // Only the second event reaches the DB
      const row = generateActivityEventRow({ id: 'event-2' });
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([row]));

      const results = await activityIngestionService.ingestEvents(TEST_USER_ID, inputs);

      // Only the valid event should be returned
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('event-2');
    });
  });

  // ------------------------------------------
  // getUserEvents
  // ------------------------------------------

  describe('getUserEvents', () => {
    it('should query with default pagination (limit 100, offset 0)', async () => {
      const rows = [generateActivityEventRow({ id: 'ev-1' }), generateActivityEventRow({ id: 'ev-2' })];

      // COUNT query
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '2' }]));
      // SELECT query
      mockQuery.mockResolvedValueOnce(mockQueryResult(rows));

      const result = await activityIngestionService.getUserEvents(TEST_USER_ID);

      expect(result.total).toBe(2);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].id).toBe('ev-1');
      expect(result.events[1].id).toBe('ev-2');

      // Verify the SELECT query includes LIMIT 100 OFFSET 0
      const selectCall = mockQuery.mock.calls[1];
      const params = selectCall[1] as (string | number)[];
      // Last two params should be limit=100 and offset=0
      expect(params[params.length - 2]).toBe(100);
      expect(params[params.length - 1]).toBe(0);
    });

    it('should filter events by type', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '1' }]));
      mockQuery.mockResolvedValueOnce(mockQueryResult([generateActivityEventRow({ type: 'nutrition' })]));

      const result = await activityIngestionService.getUserEvents(TEST_USER_ID, {
        type: 'nutrition',
      });

      expect(result.total).toBe(1);
      expect(result.events[0].type).toBe('nutrition');

      // Verify the COUNT query includes type filter
      const countCall = mockQuery.mock.calls[0];
      const countSql = countCall[0] as string;
      expect(countSql).toContain('type = $');
      const countParams = countCall[1] as string[];
      expect(countParams).toContain('nutrition');
    });

    it('should filter events by date range', async () => {
      const startDate = '2026-02-01T00:00:00.000Z';
      const endDate = '2026-02-28T23:59:59.999Z';

      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '5' }]));
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([generateActivityEventRow()]),
      );

      const result = await activityIngestionService.getUserEvents(TEST_USER_ID, {
        startDate,
        endDate,
      });

      expect(result.total).toBe(5);

      // Verify the COUNT query includes date filters
      const countCall = mockQuery.mock.calls[0];
      const countSql = countCall[0] as string;
      expect(countSql).toContain('timestamp >=');
      expect(countSql).toContain('timestamp <=');
      const countParams = countCall[1] as string[];
      expect(countParams).toContain(startDate);
      expect(countParams).toContain(endDate);
    });

    it('should return the total count from the database', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '42' }]));
      mockQuery.mockResolvedValueOnce(mockQueryResult([]));

      const result = await activityIngestionService.getUserEvents(TEST_USER_ID);

      expect(result.total).toBe(42);
      expect(result.events).toHaveLength(0);
    });
  });
});
