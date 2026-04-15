import type { Response, Request } from 'express';
import type { ApiResponse as IApiResponse, PaginationMeta, ValidationError, AuthenticatedRequest } from '../types/index.js';

type SuccessOptions = {
  message?: string;
  statusCode?: number;
  meta?: PaginationMeta;
  requestId?: string;
};

/**
 * Extract requestId from request object if available
 */
function extractRequestId(req?: Request | AuthenticatedRequest): string | undefined {
  if (!req) return undefined;
  return (req as AuthenticatedRequest).requestId;
}

export class ApiResponse {
  // Success responses - supports both object options and legacy string message
  static success<T>(
    res: Response,
    data?: T,
    optionsOrMessage: SuccessOptions | string = {},
    statusCode?: number,
    req?: Request | AuthenticatedRequest
  ): Response {
    // Support both object options and legacy string message
    const options: SuccessOptions = typeof optionsOrMessage === 'string'
      ? { message: optionsOrMessage, statusCode: statusCode ?? 200 }
      : optionsOrMessage;

    // Extract requestId from request if not explicitly provided in options
    const requestId = options.requestId || extractRequestId(req);

    const { message = 'Success', statusCode: code = 200, meta } = options;

    const response: IApiResponse<T> = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      ...(data !== undefined && { data }),
      ...(meta && { meta }),
      ...(requestId && { requestId }),
    };

    return res.status(code).json(response);
  }

  static created<T>(res: Response, data: T, message = 'Resource created successfully', req?: Request | AuthenticatedRequest): Response {
    return this.success(res, data, { message, statusCode: 201 }, undefined, req);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message = 'Success',
    req?: Request | AuthenticatedRequest
  ): Response {
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return this.success(res, data, { message, meta }, undefined, req);
  }

  // Error responses
  static error(
    res: Response,
    options: {
      message?: string;
      statusCode?: number;
      code?: string;
      errors?: ValidationError[];
      requestId?: string;
    } = {},
    req?: Request | AuthenticatedRequest
  ): Response {
    const {
      message = 'An error occurred',
      statusCode = 500,
      code: _code = 'INTERNAL_ERROR',
      errors,
      requestId: explicitRequestId,
    } = options;

    // Extract requestId from request if not explicitly provided in options
    const requestId = explicitRequestId || extractRequestId(req);

    const response: IApiResponse = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      ...(errors && { errors }),
      ...(requestId && { requestId }),
    };

    return res.status(statusCode).json(response);
  }

  static badRequest(res: Response, message = 'Bad Request', errors?: ValidationError[], req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 400, code: 'BAD_REQUEST', errors }, req);
  }

  static unauthorized(res: Response, message = 'Unauthorized', req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 401, code: 'UNAUTHORIZED' }, req);
  }

  static forbidden(res: Response, message = 'Forbidden', req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 403, code: 'FORBIDDEN' }, req);
  }

  static notFound(res: Response, message = 'Resource not found', req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 404, code: 'NOT_FOUND' }, req);
  }

  static conflict(res: Response, message = 'Resource already exists', req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 409, code: 'CONFLICT' }, req);
  }

  static validationError(res: Response, errors: ValidationError[], req?: Request | AuthenticatedRequest): Response {
    return this.error(res, {
      message: 'Validation Error',
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      errors,
    }, req);
  }

  static tooManyRequests(res: Response, message = 'Too many requests', req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 429, code: 'TOO_MANY_REQUESTS' }, req);
  }

  static internal(res: Response, message = 'Internal Server Error', req?: Request | AuthenticatedRequest): Response {
    return this.error(res, { message, statusCode: 500, code: 'INTERNAL_SERVER_ERROR' }, req);
  }
}

export default ApiResponse;
