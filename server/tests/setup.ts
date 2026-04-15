/**
 * Jest Test Setup
 * This file runs before each test file
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file so DB credentials are available for all tests
// (Tests that don't import app.ts won't get dotenv loaded otherwise)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-purposes-only';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-key-for-testing';
process.env['JWT_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['JWT_ISSUER'] = 'yhealth-api-test';
process.env['JWT_AUDIENCE'] = 'yhealth-client-test';

// Global error handlers for unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Type declarations for custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

export {};
