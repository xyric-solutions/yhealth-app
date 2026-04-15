import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../config/env.config.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * User-based key generator - uses user ID if authenticated, otherwise uses a normalized IP key
 * This key generator is for user-based rate limiting where authenticated users get their own bucket
 */
function userKeyGenerator(req: Request): string {
  const user = (req as AuthenticatedRequest).user;
  if (user?.userId) {
    return `user:${user.userId}`;
  }
  // For unauthenticated requests, use a prefixed key to avoid the IPv6 validation
  // The prefix ensures express-rate-limit doesn't detect it as a raw IP
  return `anon:${req.ip || 'unknown'}`;
}

/**
 * Rate limit exceeded handler
 */
function handleRateLimitExceeded(req: Request, res: Response): void {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: (req as AuthenticatedRequest).user?.userId,
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Global rate limiter - applies to all routes
 * Uses default IP-based key generator (handles IPv6 properly)
 */
export const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
});

/**
 * Auth rate limiter - stricter limits for auth endpoints
 * Uses default IP-based key generator (handles IPv6 properly)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, message: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
});

/**
 * Strict rate limiter - for sensitive operations
 * Uses default IP-based key generator (handles IPv6 properly)
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { success: false, message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
});

/**
 * API rate limiter - per user limits
 * Uses custom key generator with prefixed keys (not raw IPs)
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  message: { success: false, message: 'API rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
  validate: false,
});

/**
 * Upload rate limiter - for file uploads
 * Uses custom key generator with prefixed keys (not raw IPs)
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: { success: false, message: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
  validate: false,
});

/**
 * Create custom rate limiter
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: 'ip' | 'user';
}) {
  const baseOptions = {
    windowMs: options.windowMs,
    max: options.max,
    message: { success: false, message: options.message || 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: handleRateLimitExceeded,
    skip: () => env.isTest,
  };

  // Only add custom keyGenerator for user-based limiting
  if (options.keyGenerator === 'user') {
    return rateLimit({
      ...baseOptions,
      keyGenerator: userKeyGenerator,
      validate: false,
    });
  }

  // Use default IP-based key generator (handles IPv6 properly)
  return rateLimit(baseOptions);
}

/**
 * AI generation limiter — expensive LLM operations (5 per hour per user)
 */
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'AI generation limit reached. Please wait before generating again.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  validate: false,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
});

/**
 * Messaging limiter — chat/coaching messages (120 per hour per user)
 */
export const messagingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Message limit reached. Please wait before sending more.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  validate: false,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
});

/**
 * Data export limiter — CSV/JSON exports (10 per hour per user)
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Export limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  validate: false,
  handler: handleRateLimitExceeded,
  skip: () => env.isTest,
});

export default globalLimiter;
