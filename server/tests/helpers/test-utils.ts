/**
 * @file Test Utilities
 * @description Senior-level test utilities for deterministic, isolated testing
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock repository with standard CRUD operations
 */
export function createMockRepository<T = any>() {
  return {
    getMetrics: jest.fn<() => Promise<T | null>>(),
    findById: jest.fn<() => Promise<T | null>>(),
    findAll: jest.fn<() => Promise<T[]>>(),
    create: jest.fn<() => Promise<T>>(),
    update: jest.fn<() => Promise<T>>(),
    delete: jest.fn<() => Promise<void>>(),
  };
}

/**
 * Creates a mock cache service
 */
export function createMockCache() {
  return {
    get: jest.fn<() => any>(),
    set: jest.fn<() => void>(),
    delete: jest.fn<() => void>(),
    clear: jest.fn<() => void>(),
    has: jest.fn<() => boolean>(),
  };
}

/**
 * Creates a mock logger
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a mock database query function
 */
export function createMockQuery() {
  return jest.fn<() => Promise<any[]>>();
}

/**
 * Waits for async operations to complete
 * Senior-level: Ensures all promises resolve before assertions
 */
export async function waitForAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Creates a deterministic date for testing
 */
export function createTestDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Property-based test helper: Generates test cases
 */
export function generateTestCases<T>(
  generator: () => T,
  count: number = 10
): T[] {
  return Array.from({ length: count }, generator);
}

/**
 * Failure injection helper
 */
export function injectFailure(
  mockFn: jest.Mock,
  error: Error,
  times: number = 1
) {
  let callCount = 0;
  mockFn.mockImplementation(() => {
    callCount++;
    if (callCount <= times) {
      throw error;
    }
    return Promise.resolve(null);
  });
}

/**
 * Assertion helper: Validates business contract
 */
export function assertContract<T>(
  value: T,
  validator: (v: T) => boolean,
  message: string
) {
  if (!validator(value)) {
    throw new Error(`Contract violation: ${message}`);
  }
}

