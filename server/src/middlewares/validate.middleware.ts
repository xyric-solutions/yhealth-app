import type { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import type { AppErrorDetails } from '../types/index.js';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Validates request data against a Zod schema
 */
export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { stripUnknown = true } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];

      const parseMethod = stripUnknown ? schema.safeParse : schema.safeParse;
      const result = parseMethod.call(schema, dataToValidate);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        throw ApiError.validation(errors);
      }

      // Replace request data with parsed/transformed data
      // req.query is a getter in newer Express versions, so use defineProperty
      if (target === 'query') {
        Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
      } else {
        req[target] = result.data;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate multiple targets at once
 */
export function validateRequest(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allErrors: AppErrorDetails[] = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const result = schema.safeParse(req[target as ValidationTarget]);

      if (!result.success) {
        const errors = formatZodErrors(result.error, target);
        allErrors.push(...errors);
      } else {
        if (target === 'query') {
          Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
        } else {
          req[target as ValidationTarget] = result.data;
        }
      }
    }

    if (allErrors.length > 0) {
      next(ApiError.validation(allErrors));
    } else {
      next();
    }
  };
}

/**
 * Format Zod errors to AppErrorDetails
 */
function formatZodErrors(error: ZodError, prefix?: string): AppErrorDetails[] {
  return error.errors.map(err => {
    const path = err.path.join('.');
    const field = prefix ? `${prefix}.${path}` : path;

    return {
      field: field || 'unknown',
      message: err.message,
      code: err.code,
    };
  });
}

// Common validation schemas
export const commonSchemas = {
  // MongoDB ObjectId
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Email
  email: z.string().email('Invalid email format').toLowerCase().trim(),

  // Password (strong)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  // Phone number
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),

  // UUID
  uuid: z.string().uuid('Invalid UUID format'),

  // Date string
  dateString: z.string().datetime({ message: 'Invalid date format' }),

  // URL
  url: z.string().url('Invalid URL format'),

  // Non-empty string
  nonEmptyString: z.string().trim().min(1, 'This field cannot be empty'),
};

export default validate;
