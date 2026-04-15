/**
 * @file Main src barrel export
 *
 * This is the main entry point for all src modules.
 *
 * Usage:
 * import { useOnboarding, Plan, useAsyncState } from '@/src';
 *
 * Or import from specific modules:
 * import { useOnboarding } from '@/src/features/onboarding';
 * import { Plan } from '@/src/types';
 * import { useAsyncState } from '@/src/shared/hooks';
 */

// Types
export * from './types';

// Shared utilities
export * from './shared';

// Features
export * from './features';
