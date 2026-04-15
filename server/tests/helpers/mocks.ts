/**
 * Mock Implementations for Testing
 */

import { jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, IJwtPayload } from '../../src/types/index.js';

// Type helper for ESM jest mocks
type _MockFn = ReturnType<typeof jest.fn>;

/**
 * Create a mock Express Request
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    get: jest.fn() as unknown as Request['get'],
    ...overrides,
  };
}

/**
 * Create a mock Express Response
 */
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  res.send = jest.fn().mockReturnValue(res) as unknown as Response['send'];
  res.cookie = jest.fn().mockReturnValue(res) as unknown as Response['cookie'];
  res.clearCookie = jest.fn().mockReturnValue(res) as unknown as Response['clearCookie'];
  res.setHeader = jest.fn().mockReturnValue(res) as unknown as Response['setHeader'];
  res.end = jest.fn().mockReturnValue(res) as unknown as Response['end'];
  return res;
}

/**
 * Create a mock Express NextFunction
 */
export function createMockNext(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

/**
 * Create a mock authenticated request
 */
export function createMockAuthRequest(
  user: Partial<IJwtPayload>,
  overrides: Partial<AuthenticatedRequest> = {}
): Partial<AuthenticatedRequest> {
  return {
    ...createMockRequest(overrides as Partial<Request>),
    user: {
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
      ...user,
    } as IJwtPayload,
    ...overrides,
  };
}

/**
 * Mock Logger Service
 */
export const mockLogger = {
  info: jest.fn<() => void>(),
  error: jest.fn<() => void>(),
  warn: jest.fn<() => void>(),
  debug: jest.fn<() => void>(),
  http: jest.fn<() => void>(),
};

/**
 * Mock Email Service
 */
export const mockEmailService = {
  sendEmail: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  sendVerificationEmail: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
};

/**
 * Mock SMS Service
 */
export const mockSMSService = {
  sendVerificationCode: jest.fn<() => Promise<{ success: boolean; code: string }>>().mockResolvedValue({ success: true, code: '123456' }),
  verifyCode: jest.fn<() => Promise<{ success: boolean }>>().mockResolvedValue({ success: true }),
  formatPhoneNumber: jest.fn<(phone: string) => string>().mockImplementation((phone: string) => phone),
};

/**
 * Mock OAuth Service
 */
export const mockOAuthService = {
  verifyGoogleToken: jest.fn<() => Promise<{ provider: string; providerId: string; email: string; firstName: string; lastName: string }>>().mockResolvedValue({
    provider: 'google',
    providerId: 'google-123',
    email: 'test@gmail.com',
    firstName: 'Test',
    lastName: 'User',
  }),
  verifyAppleToken: jest.fn<() => Promise<{ provider: string; providerId: string; email: string }>>().mockResolvedValue({
    provider: 'apple',
    providerId: 'apple-123',
    email: 'test@icloud.com',
  }),
  verifySocialToken: jest.fn<() => Promise<{ provider: string; providerId: string; email: string }>>().mockResolvedValue({
    provider: 'google',
    providerId: 'google-123',
    email: 'test@gmail.com',
  }),
};

/**
 * Mock Cache Service
 */
export const mockCacheService = {
  get: jest.fn<() => null>().mockReturnValue(null),
  set: jest.fn<() => void>(),
  del: jest.fn<() => void>(),
  has: jest.fn<() => boolean>().mockReturnValue(false),
  flush: jest.fn<() => void>(),
  getStats: jest.fn<() => { keys: number; hits: number; misses: number }>().mockReturnValue({ keys: 0, hits: 0, misses: 0 }),
};

/**
 * Reset all mocks
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
  mockLogger.info.mockClear();
  mockLogger.error.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.debug.mockClear();
  mockEmailService.sendEmail.mockClear();
  mockSMSService.sendVerificationCode.mockClear();
  mockSMSService.verifyCode.mockClear();
  mockOAuthService.verifyGoogleToken.mockClear();
  mockOAuthService.verifyAppleToken.mockClear();
  mockCacheService.get.mockClear();
  mockCacheService.set.mockClear();
}
