/**
 * @file Shared types - Single source of truth
 * @description This package contains all shared types between client and server.
 *              Import from here to ensure type consistency across the codebase.
 *
 * @example
 * // In client code:
 * import type { Goal, Plan, PlanStatus } from '@/shared/types';
 *
 * // In server code:
 * import type { Goal, Plan, PlanStatus } from '../../shared/types/index.js';
 */

// Domain types
export * from './domain';

// API types
export * from './api';
