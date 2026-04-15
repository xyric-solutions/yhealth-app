export { ApiError } from './ApiError.js';
export { ApiResponse } from './ApiResponse.js';
export { asyncHandler, asyncMiddleware, withTimeout, withRetry } from './asyncHandler.js';

/**
 * Safely convert a PostgreSQL DATE column value to a "YYYY-MM-DD" string.
 * The custom pg type parser (OID 1082) returns DATE columns as plain strings,
 * but TypeScript types still declare them as Date. This handles both cases.
 */
export function toDateStr(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value.toISOString().split('T')[0];
}
