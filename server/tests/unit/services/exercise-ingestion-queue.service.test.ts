/**
 * Exercise Ingestion Queue Service Unit Tests
 *
 * Tests for BullMQ queue management: job enqueueing, status queries,
 * queue cleanup, and connection lifecycle.
 */

import { jest } from '@jest/globals';

// ============================================
// MOCKS
// ============================================

const mockQueueAdd = jest.fn<any>();
const mockQueueClean = jest.fn<any>().mockResolvedValue([]);
const mockQueueClose = jest.fn<any>().mockResolvedValue(undefined);
const mockQueueGetWaitingCount = jest.fn<any>().mockResolvedValue(0);
const mockQueueGetActiveCount = jest.fn<any>().mockResolvedValue(0);
const mockQueueGetCompletedCount = jest.fn<any>().mockResolvedValue(0);
const mockQueueGetFailedCount = jest.fn<any>().mockResolvedValue(0);
const mockQueueGetDelayedCount = jest.fn<any>().mockResolvedValue(0);

const MockQueue = jest.fn<any>().mockImplementation(() => ({
  add: mockQueueAdd,
  clean: mockQueueClean,
  close: mockQueueClose,
  getWaitingCount: mockQueueGetWaitingCount,
  getActiveCount: mockQueueGetActiveCount,
  getCompletedCount: mockQueueGetCompletedCount,
  getFailedCount: mockQueueGetFailedCount,
  getDelayedCount: mockQueueGetDelayedCount,
}));

jest.unstable_mockModule('bullmq', () => ({
  Queue: MockQueue,
}));

jest.unstable_mockModule('../../../src/config/queue.config.js', () => ({
  redisConnection: { host: 'localhost', port: 6379 },
  QueueNames: { EXERCISE_INGESTION: 'exercise-ingestion' },
  JobTypes: {
    INGEST_EXERCISE_BATCH: 'ingest-exercise-batch',
    SYNC_EXERCISES: 'sync-exercises',
  },
  queueConfig: {
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
  },
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Dynamic imports after mocks
const {
  enqueueFullIngestion,
  enqueueIncrementalSync,
  getIngestionStatus,
  cleanQueue,
  closeQueue,
} = await import('../../../src/services/exercise-ingestion-queue.service.js');

// ============================================
// TESTS
// ============================================

describe('ExerciseIngestionQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish MockQueue implementation (resetMocks: true in config clears it)
    MockQueue.mockImplementation(() => ({
      add: mockQueueAdd,
      clean: mockQueueClean,
      close: mockQueueClose,
      getWaitingCount: mockQueueGetWaitingCount,
      getActiveCount: mockQueueGetActiveCount,
      getCompletedCount: mockQueueGetCompletedCount,
      getFailedCount: mockQueueGetFailedCount,
      getDelayedCount: mockQueueGetDelayedCount,
    }));
    // Reset queue add to return job with id
    mockQueueAdd.mockResolvedValue({ id: 'job-001' });
    mockQueueClean.mockResolvedValue([]);
    mockQueueClose.mockResolvedValue(undefined);
    mockQueueGetWaitingCount.mockResolvedValue(0);
    mockQueueGetActiveCount.mockResolvedValue(0);
    mockQueueGetCompletedCount.mockResolvedValue(0);
    mockQueueGetFailedCount.mockResolvedValue(0);
    mockQueueGetDelayedCount.mockResolvedValue(0);
  });

  // ------------------------------------------
  // enqueueFullIngestion
  // ------------------------------------------
  describe('enqueueFullIngestion', () => {
    it('should create multiple batched jobs', async () => {
      const jobIds = await enqueueFullIngestion('exercisedb', {
        batchSize: 500,
        totalEstimate: 1500,
      });

      // 1500 / 500 = 3 batches
      expect(mockQueueAdd).toHaveBeenCalledTimes(3);
      expect(jobIds).toHaveLength(3);
    });

    it('should pass correct batch data to each job', async () => {
      await enqueueFullIngestion('exercisedb', {
        batchSize: 500,
        totalEstimate: 1000,
      });

      // First batch
      expect(mockQueueAdd.mock.calls[0][1]).toEqual({
        source: 'exercisedb',
        batchOffset: 0,
        batchSize: 500,
      });

      // Second batch
      expect(mockQueueAdd.mock.calls[1][1]).toEqual({
        source: 'exercisedb',
        batchOffset: 500,
        batchSize: 500,
      });
    });

    it('should stagger job delays by 1 second', async () => {
      await enqueueFullIngestion('exercisedb', {
        batchSize: 500,
        totalEstimate: 1500,
      });

      expect(mockQueueAdd.mock.calls[0][2]).toEqual(expect.objectContaining({ delay: 0 }));
      expect(mockQueueAdd.mock.calls[1][2]).toEqual(expect.objectContaining({ delay: 1000 }));
      expect(mockQueueAdd.mock.calls[2][2]).toEqual(expect.objectContaining({ delay: 2000 }));
    });

    it('should set medium priority for batch jobs', async () => {
      await enqueueFullIngestion('exercisedb', {
        batchSize: 500,
        totalEstimate: 500,
      });

      expect(mockQueueAdd.mock.calls[0][2]).toEqual(expect.objectContaining({ priority: 3 }));
    });

    it('should use default batchSize=500 and totalEstimate=1500', async () => {
      await enqueueFullIngestion('exercisedb');

      expect(mockQueueAdd).toHaveBeenCalledTimes(3); // ceil(1500/500)
    });

    it('should handle rapidapi source', async () => {
      await enqueueFullIngestion('rapidapi', { batchSize: 500, totalEstimate: 500 });

      expect(mockQueueAdd.mock.calls[0][1]).toEqual(expect.objectContaining({
        source: 'rapidapi',
      }));
    });
  });

  // ------------------------------------------
  // enqueueIncrementalSync
  // ------------------------------------------
  describe('enqueueIncrementalSync', () => {
    it('should enqueue a single sync job', async () => {
      const jobId = await enqueueIncrementalSync('exercisedb');

      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
      expect(jobId).toBe('job-001');
    });

    it('should use sync-exercises job type', async () => {
      await enqueueIncrementalSync('exercisedb');

      expect(mockQueueAdd.mock.calls[0][0]).toBe('sync-exercises');
    });

    it('should set low priority for sync jobs', async () => {
      await enqueueIncrementalSync('exercisedb');

      expect(mockQueueAdd.mock.calls[0][2]).toEqual(expect.objectContaining({ priority: 2 }));
    });

    it('should include unique jobId to prevent duplicates', async () => {
      await enqueueIncrementalSync('exercisedb');

      const jobOptions = mockQueueAdd.mock.calls[0][2] as Record<string, unknown>;
      expect(jobOptions.jobId).toMatch(/^sync-exercisedb-/);
    });

    it('should return null if job has no id', async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: undefined });

      const jobId = await enqueueIncrementalSync('exercisedb');
      expect(jobId).toBeNull();
    });
  });

  // ------------------------------------------
  // getIngestionStatus
  // ------------------------------------------
  describe('getIngestionStatus', () => {
    it('should return all queue status counts', async () => {
      mockQueueGetWaitingCount.mockResolvedValueOnce(5);
      mockQueueGetActiveCount.mockResolvedValueOnce(2);
      mockQueueGetCompletedCount.mockResolvedValueOnce(100);
      mockQueueGetFailedCount.mockResolvedValueOnce(3);
      mockQueueGetDelayedCount.mockResolvedValueOnce(10);

      const status = await getIngestionStatus();

      expect(status).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 10,
      });
    });
  });

  // ------------------------------------------
  // cleanQueue
  // ------------------------------------------
  describe('cleanQueue', () => {
    it('should clean completed and failed jobs', async () => {
      await cleanQueue();

      expect(mockQueueClean).toHaveBeenCalledTimes(2);
      expect(mockQueueClean).toHaveBeenCalledWith(3600000, 1000, 'completed');
      expect(mockQueueClean).toHaveBeenCalledWith(3600000, 1000, 'failed');
    });

    it('should accept custom grace period', async () => {
      await cleanQueue(7200000);

      expect(mockQueueClean).toHaveBeenCalledWith(7200000, 1000, 'completed');
      expect(mockQueueClean).toHaveBeenCalledWith(7200000, 1000, 'failed');
    });
  });

  // ------------------------------------------
  // closeQueue
  // ------------------------------------------
  describe('closeQueue', () => {
    it('should close the queue connection', async () => {
      // Force queue initialization first by calling a method
      await enqueueIncrementalSync('exercisedb');

      await closeQueue();
      // No assertion on mock since queue is internal, just verify no error
    });
  });
});
