/**
 * ApiError Utility Unit Tests
 */

import { ApiError } from '../../../src/utils/ApiError.js';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create an error with statusCode and message', () => {
      const error = new ApiError(400, 'Bad request');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.isOperational).toBe(true);
    });

    it('should set isOperational to true by default', () => {
      const error = new ApiError(500, 'Internal error');
      expect(error.isOperational).toBe(true);
    });

    it('should allow setting isOperational to false', () => {
      const error = new ApiError(500, 'Internal error', { isOperational: false });
      expect(error.isOperational).toBe(false);
    });

    it('should capture stack trace', () => {
      const error = new ApiError(400, 'Test error');
      expect(error.stack).toBeDefined();
    });

    it('should set code from options', () => {
      const error = new ApiError(400, 'Test error', { code: 'CUSTOM_CODE' });
      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should set default code based on statusCode', () => {
      const error = new ApiError(404, 'Not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should include details when provided', () => {
      const details = [{ code: 'INVALID_EMAIL', field: 'email', message: 'Invalid' }];
      const error = new ApiError(400, 'Validation error', { details });
      expect(error.details).toEqual(details);
    });
  });

  describe('static factory methods', () => {
    describe('badRequest', () => {
      it('should create a 400 error', () => {
        const error = ApiError.badRequest('Invalid input');

        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Invalid input');
        expect(error.code).toBe('BAD_REQUEST');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.badRequest();

        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Bad Request');
      });
    });

    describe('unauthorized', () => {
      it('should create a 401 error', () => {
        const error = ApiError.unauthorized('Invalid credentials');

        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Invalid credentials');
        expect(error.code).toBe('UNAUTHORIZED');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.unauthorized();

        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Unauthorized');
      });
    });

    describe('forbidden', () => {
      it('should create a 403 error', () => {
        const error = ApiError.forbidden('Access denied');

        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('Access denied');
        expect(error.code).toBe('FORBIDDEN');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.forbidden();

        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('Forbidden');
      });
    });

    describe('notFound', () => {
      it('should create a 404 error', () => {
        const error = ApiError.notFound('User not found');

        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('User not found');
        expect(error.code).toBe('NOT_FOUND');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.notFound();

        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Resource not found');
      });
    });

    describe('conflict', () => {
      it('should create a 409 error', () => {
        const error = ApiError.conflict('Email already exists');

        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('Email already exists');
        expect(error.code).toBe('CONFLICT');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.conflict();

        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('Resource already exists');
      });
    });

    describe('internal', () => {
      it('should create a 500 error', () => {
        const error = ApiError.internal('Database connection failed');

        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Database connection failed');
        expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.internal();

        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Internal Server Error');
      });

      it('should set isOperational to false', () => {
        const error = ApiError.internal();
        expect(error.isOperational).toBe(false);
      });
    });

    describe('validation', () => {
      it('should create a 400 error with validation details', () => {
        const details = [
          { code: 'INVALID_EMAIL', field: 'email', message: 'Invalid email format' },
          { code: 'INVALID_PASSWORD', field: 'password', message: 'Password too short' },
        ];

        const error = ApiError.validation(details);

        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.details).toEqual(details);
      });

      it('should have default validation message', () => {
        const error = ApiError.validation([]);
        expect(error.message).toBe('Validation Error');
      });
    });

    describe('tooManyRequests', () => {
      it('should create a 429 error', () => {
        const error = ApiError.tooManyRequests('Rate limit exceeded');

        expect(error.statusCode).toBe(429);
        expect(error.message).toBe('Rate limit exceeded');
        expect(error.code).toBe('TOO_MANY_REQUESTS');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.tooManyRequests();

        expect(error.statusCode).toBe(429);
        expect(error.message).toBe('Too many requests');
      });
    });

    describe('unprocessableEntity', () => {
      it('should create a 422 error', () => {
        const error = ApiError.unprocessableEntity('Cannot process request');

        expect(error.statusCode).toBe(422);
        expect(error.message).toBe('Cannot process request');
        expect(error.code).toBe('UNPROCESSABLE_ENTITY');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.unprocessableEntity();

        expect(error.statusCode).toBe(422);
        expect(error.message).toBe('Unprocessable Entity');
      });
    });

    describe('serviceUnavailable', () => {
      it('should create a 503 error', () => {
        const error = ApiError.serviceUnavailable('Service down');

        expect(error.statusCode).toBe(503);
        expect(error.message).toBe('Service down');
        expect(error.code).toBe('SERVICE_UNAVAILABLE');
      });

      it('should use default message if not provided', () => {
        const error = ApiError.serviceUnavailable();

        expect(error.statusCode).toBe(503);
        expect(error.message).toBe('Service Unavailable');
      });
    });
  });

  describe('fromError', () => {
    it('should return same ApiError instance if already ApiError', () => {
      const original = new ApiError(400, 'Test');
      const result = ApiError.fromError(original);
      expect(result).toBe(original);
    });

    it('should convert regular Error to ApiError', () => {
      const original = new Error('Regular error');
      const result = ApiError.fromError(original);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Regular error');
      expect(result.isOperational).toBe(false);
    });

    it('should use custom status code when converting', () => {
      const original = new Error('Not found error');
      const result = ApiError.fromError(original, 404);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('toJSON', () => {
    it('should return proper JSON structure', () => {
      const error = new ApiError(400, 'Test error', { code: 'TEST_CODE' });
      const json = error.toJSON();

      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect((json.error as Record<string, unknown>).code).toBe('TEST_CODE');
      expect((json.error as Record<string, unknown>).message).toBe('Test error');
      expect((json.error as Record<string, unknown>).statusCode).toBe(400);
      expect((json.error as Record<string, unknown>).timestamp).toBeDefined();
    });

    it('should include details in JSON when present', () => {
      const details = [{ code: 'INVALID_EMAIL', field: 'email', message: 'Invalid' }];
      const error = new ApiError(400, 'Test', { details });
      const json = error.toJSON();

      expect((json.error as Record<string, unknown>).details).toEqual(details);
    });
  });

  describe('instanceof checks', () => {
    it('should be instanceof Error', () => {
      const error = new ApiError(400, 'Test');
      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof ApiError', () => {
      const error = new ApiError(400, 'Test');
      expect(error instanceof ApiError).toBe(true);
    });

    it('should differentiate from regular Error', () => {
      const regularError = new Error('Test');
      const apiError = new ApiError(400, 'Test');

      expect(regularError instanceof ApiError).toBe(false);
      expect(apiError instanceof ApiError).toBe(true);
    });
  });
});
