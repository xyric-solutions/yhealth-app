import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../services/logger.service.js';
import { env } from '../config/env.config.js';
import type { AuthenticatedRequest } from '../types/index.js';

// JWT errors
interface JWTError extends Error {
  expiredAt?: Date;
}

// PostgreSQL error interface
interface PgError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
}

/**
 * Convert various error types to ApiError
 */
function normalizeError(error: Error): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error;
  }

  // PostgreSQL errors (from pg client)
  const pgError = error as PgError;
  if (pgError.code) {
    // Unique constraint violation
    if (pgError.code === '23505') {
      const detail = pgError.detail || '';
      const match = detail.match(/Key \((.+?)\)=/);
      const field = match ? match[1] : 'field';
      return ApiError.conflict(`${field} already exists`);
    }

    // Foreign key constraint violation
    if (pgError.code === '23503') {
      const detail = pgError.detail || '';
      const constraint = pgError.constraint || '';
      logger.warn('Foreign key constraint violation', {
        detail,
        constraint,
        table: pgError.table,
      });
      return ApiError.badRequest(
        env.isProduction ? 'Invalid reference provided' : `Invalid reference: ${detail || constraint}`
      );
    }

    // Not null violation
    if (pgError.code === '23502') {
      const column = pgError.column || 'field';
      return ApiError.badRequest(`${column} is required`);
    }

    // Check constraint violation
    if (pgError.code === '23514') {
      return ApiError.badRequest('Invalid data provided');
    }

    // Undefined table (relation does not exist)
    if (pgError.code === '42P01') {
      const tableMatch = pgError.message?.match(/relation "(.+?)" does not exist/i);
      const tableName = tableMatch ? tableMatch[1] : 'unknown';
      logger.error('Database table does not exist', { 
        error: pgError.message,
        table: tableName,
        code: pgError.code
      });
      return ApiError.internal(
        env.isProduction ? 'A database error occurred' : `Database table "${tableName}" does not exist. Please run migrations.`
      );
    }

    // Undefined column
    if (pgError.code === '42703') {
      const columnMatch = pgError.message?.match(/column "(.+?)" does not exist/i);
      const columnName = columnMatch ? columnMatch[1] : 'unknown';
      const tableMatch = pgError.message?.match(/relation "(.+?)"/i);
      const tableName = tableMatch ? tableMatch[1] : 'unknown';
      logger.error('Database column does not exist', { 
        error: pgError.message,
        table: tableName,
        column: columnName,
        code: pgError.code
      });
      return ApiError.internal(
        `Database column "${columnName}" does not exist in table "${tableName}". Please run migrations.`
      );
    }
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    const jwtError = error as JWTError;
    return ApiError.unauthorized(`Token expired${jwtError.expiredAt ? ` at ${jwtError.expiredAt.toISOString()}` : ''}`);
  }

  if (error.name === 'NotBeforeError') {
    return ApiError.unauthorized('Token not yet valid');
  }

  // Syntax error (invalid JSON)
  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('Invalid JSON in request body');
  }

  // Default to internal server error
  return ApiError.internal(env.isProduction ? 'Something went wrong' : error.message);
}

/**
 * Log error details
 */
function logError(error: ApiError, req: Request): void {
  const logData = {
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    requestId: (req as AuthenticatedRequest).requestId,
    userId: (req as AuthenticatedRequest).user?.userId,
    ...(error.details && { details: error.details }),
    ...(!error.isOperational && { stack: error.stack }),
  };

  if (error.statusCode >= 500) {
    logger.error('Server error', logData);
  } else if (error.statusCode >= 400) {
    logger.warn('Client error', logData);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response | any,
  _next: NextFunction
): void => {

  // CRITICAL: Check if res is a valid Express Response object
  // Use Object.prototype.hasOwnProperty to safely check
  if (!res) {
    console.error('[ErrorHandler] Response object is null/undefined', {
      error: error?.message || String(error),
      path: req?.path || 'unknown',
      method: req?.method || 'unknown',
    });
    return;
  }

  if (typeof res !== 'object') {
    console.error('[ErrorHandler] Response object is not an object', {
      resType: typeof res,
      error: error?.message || String(error),
      path: req?.path || 'unknown',
      method: req?.method || 'unknown',
    });
    return;
  }

  // Safely check if res.status exists - check 'status' in res and typeof separately
  // Express Response has status on prototype, so we can't use hasOwnProperty alone
  let hasStatus = false;
  let hasHeadersSent = false;
  
  try {
    // Check if 'status' exists (own property or prototype) and is callable
    // Use 'in' operator to check prototype chain, then verify it's a function
    const statusExists = 'status' in res;
    const statusIsFunction = statusExists ? (typeof res.status === 'function') : false;
    
    // For Express Response, status should exist on prototype
    // For raw ServerResponse, it won't exist at all
    hasStatus = statusIsFunction;
    hasHeadersSent = ('headersSent' in res) && res.headersSent;
    
  } catch (checkError) {
    console.error('[ErrorHandler] Error checking res properties', {
      error: checkError instanceof Error ? checkError.message : String(checkError),
      path: req?.path || 'unknown',
      method: req?.method || 'unknown',
    });
    hasStatus = false;
  }
  
  // Check if response has already been sent
  if (hasHeadersSent && res.headersSent) {
    try {
      logger.warn('Error occurred after response was sent', {
        message: error?.message || String(error),
        path: req?.path,
        method: req?.method,
      });
    } catch {
      console.error('[ErrorHandler] Error occurred after response was sent');
    }
    return;
  }

  // If res.status is not a function, it's likely a raw Node.js ServerResponse
  // Use Node.js HTTP methods directly
  if (!hasStatus) {
    
    // Normalize error first
    let apiError: ApiError;
    try {
      apiError = normalizeError(error);
    } catch (normalizeErr) {
      console.error('[ErrorHandler] Failed to normalize error', {
        originalError: error instanceof Error ? error.message : String(error),
        normalizeError: normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr),
      });
      apiError = new ApiError(500, 'Internal Server Error', {
        code: 'INTERNAL_SERVER_ERROR',
        isOperational: false,
      });
    }

    // Log error
    try {
      logError(apiError, req);
    } catch (logErr) {
      console.error('[ErrorHandler] Failed to log error:', logErr instanceof Error ? logErr.message : String(logErr));
    }

    // Build response
    
    let response: any;
    try {
      response = {
        success: false,
        message: apiError.message,
        code: apiError.code,
        ...(apiError.details && { errors: apiError.details }),
        timestamp: new Date().toISOString(),
        ...(env.isDevelopment && { stack: apiError.stack }),
        ...((req as AuthenticatedRequest).requestId && {
          requestId: (req as AuthenticatedRequest).requestId,
        }),
      };
    } catch (_buildErr) {
      response = {
        success: false,
        message: 'Internal Server Error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      };
    }

    // Send response using Node.js HTTP methods (raw ServerResponse)
    try {
      
      // Check if headers have already been sent
      if (('_headerSent' in res) && res._headerSent) {
        // Headers already sent, can't modify
        return;
      }

      // Use writeHead for raw ServerResponse
      if (('writeHead' in res) && typeof res.writeHead === 'function') {
        res.writeHead(apiError.statusCode, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(response)),
        });
        res.end(JSON.stringify(response));
        return;
      }
      
      // Fallback to just end()
      if (('end' in res) && typeof res.end === 'function') {
        res.end(JSON.stringify(response));
        return;
      }

      console.error('[ErrorHandler] No valid response method found for raw ServerResponse');
    } catch (sendError) {
      console.error('[ErrorHandler] Failed to send response using raw HTTP methods', {
        error: sendError instanceof Error ? sendError.message : String(sendError),
        stack: sendError instanceof Error ? sendError.stack : undefined,
      });
      
      // Last resort: try to send a minimal response
      try {
        if ('end' in res && typeof res.end === 'function') {
          res.end('{"success":false,"message":"Internal Server Error","code":"INTERNAL_SERVER_ERROR"}');
        }
      } catch {
        // If even the last resort fails, log and give up
        console.error('[ErrorHandler] All response sending attempts failed');
      }
    }
    return;
  }

  // Now we know res.status exists and is a function - proceed with error handling
  
  let apiError: ApiError;
  try {
    apiError = normalizeError(error);
  } catch (normalizeErr) {
    // If normalizeError itself fails, create a basic error
    console.error('[ErrorHandler] Failed to normalize error', {
      originalError: error instanceof Error ? error.message : String(error),
      normalizeError: normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr),
      path: req?.path || 'unknown',
      method: req?.method || 'unknown',
    });
    try {
      logger.error('Failed to normalize error', {
        originalError: error instanceof Error ? error.message : String(error),
        normalizeError: normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr),
        path: req?.path,
        method: req?.method,
      });
    } catch {
      // Ignore if logger fails
    }
    apiError = new ApiError(500, 'Internal Server Error', {
      code: 'INTERNAL_SERVER_ERROR',
      isOperational: false,
    });
  }

  try {
    logError(apiError, req);
  } catch (logErr) {
    // Don't fail if logging fails
    console.error('[ErrorHandler] Failed to log error:', logErr instanceof Error ? logErr.message : String(logErr));
  }

  const response = {
    success: false,
    message: apiError.message,
    code: apiError.code,
    ...(apiError.details && { errors: apiError.details }),
    timestamp: new Date().toISOString(),
    ...(env.isDevelopment && { stack: apiError.stack }),
    ...((req as AuthenticatedRequest).requestId && {
      requestId: (req as AuthenticatedRequest).requestId,
    }),
  };

  // Now safely call res.status().json() since we've verified it exists
  // Re-verify res.status is actually a function right before using it
  try {
    
    // Double-check res.status is actually callable right before using it
    // Use try-catch around property access in case res.status throws an error
    let statusIsFunction = false;
    let jsonIsFunction = false;
    
    try {
      statusIsFunction = ('status' in res) && (typeof (res as any).status === 'function');
    } catch {
      statusIsFunction = false;
    }
    
    try {
      jsonIsFunction = ('json' in res) && (typeof (res as any).json === 'function');
    } catch {
      jsonIsFunction = false;
    }
    
    if (statusIsFunction && jsonIsFunction) {
      // Safely call res.status().json()
      try {
        (res as any).status(apiError.statusCode).json(response);
      } catch (callError) {
        // If status().json() fails, fall back to raw HTTP
        throw callError;
      }
    } else if (statusIsFunction) {
      // If status exists but json doesn't, use status() then end()
      try {
        (res as any).status(apiError.statusCode);
        if (('end' in res) && typeof (res as any).end === 'function') {
          (res as any).end(JSON.stringify(response));
        }
      } catch (callError) {
        // If status() fails, fall back to raw HTTP
        throw callError;
      }
    } else {
      // Fallback to Node.js HTTP methods
      if (('writeHead' in res) && typeof (res as any).writeHead === 'function') {
        try {
          (res as any).writeHead(apiError.statusCode, { 'Content-Type': 'application/json' });
          if (('end' in res) && typeof (res as any).end === 'function') {
            (res as any).end(JSON.stringify(response));
          }
        } catch (_callError) {
          // If writeHead fails, try just end()
          if (('end' in res) && typeof (res as any).end === 'function') {
            (res as any).end(JSON.stringify(response));
          }
        }
      } else if (('end' in res) && typeof (res as any).end === 'function') {
        (res as any).end(JSON.stringify(response));
      } else {
        console.error('[ErrorHandler] No valid response method available');
        throw new Error('No valid response method available');
      }
    }
  } catch (sendError) {
    // Last resort logging
    const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
    const errorStack = sendError instanceof Error ? sendError.stack : undefined;
    
    console.error('[ErrorHandler] Failed to send error response', {
      error: errorMessage,
      stack: errorStack,
      statusCode: apiError.statusCode,
      path: req?.path || 'unknown',
      method: req?.method || 'unknown',
    });

    // Try logger if console worked
    try {
      logger.error('Failed to send error response', {
        error: errorMessage,
        stack: errorStack,
        statusCode: apiError.statusCode,
        path: req?.path,
        method: req?.method,
      });
    } catch {
      // Ignore - already logged to console
    }
  }
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const error = ApiError.notFound(`Route ${req.method} ${req.path} not found`);

  res.status(404).json({
    success: false,
    message: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    ...((req as AuthenticatedRequest).requestId && {
      requestId: (req as AuthenticatedRequest).requestId,
    }),
  });
};

/**
 * Uncaught exception handler
 */
export function setupUncaughtHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });

    // Exit with failure
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;

    logger.error('Unhandled Rejection', { message, stack });

    // Log but don't crash — process.exit(1) kills ALL active HTTP connections,
    // causing ERR_HTTP2_PROTOCOL_ERROR for every in-flight request.
    // Railway will restart the container if it becomes unhealthy.
  });
}

export default errorHandler;
