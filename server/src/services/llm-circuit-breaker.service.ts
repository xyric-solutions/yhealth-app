/**
 * @file LLM Circuit Breaker Service
 * @description Provider-aware circuit breaker for LLM API calls.
 *
 * When an LLM provider returns 429 (rate limit / quota exceeded), this service
 * trips the circuit for that provider and tells ModelFactory to route subsequent
 * calls to the next available provider. Only blocks ALL calls when every
 * configured provider is rate-limited.
 *
 * States:
 *   CLOSED  → normal operation, calls allowed
 *   OPEN    → tripped by 429, blocks calls only if no fallback providers available
 *   HALF_OPEN → cooldown expired, allow ONE probe call to test if API is back
 */

import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class LLMCircuitBreakerService {
  private state: CircuitState = 'CLOSED';
  private trippedAt: number = 0;
  private consecutiveFailures: number = 0;
  private probeInProgress: boolean = false;

  // Cooldown starts at 5 minutes, doubles on each consecutive trip, max 60 minutes
  private baseCooldownMs = 5 * 60 * 1000;
  private maxCooldownMs = 60 * 60 * 1000;
  private currentCooldownMs = 5 * 60 * 1000;

  // Hard safety limit: force reset after 2 hours regardless of failure count
  // Prevents a single rate-limit event from killing messaging for days
  private maxOpenDurationMs = 2 * 60 * 60 * 1000;

  /**
   * Check if an LLM call is allowed right now.
   * If the failed provider is rate-limited but other providers are available,
   * calls are still allowed (ModelFactory will route to the fallback).
   */
  isCallAllowed(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    // If other providers are available, allow the call — ModelFactory will route
    // to a non-rate-limited provider automatically
    if (modelFactory.hasAvailableProviders()) {
      return true;
    }

    const elapsed = Date.now() - this.trippedAt;

    // Hard safety reset: if circuit has been open longer than maxOpenDurationMs,
    // force-close it to prevent permanent messaging outage
    if (elapsed >= this.maxOpenDurationMs) {
      logger.warn('[LLMCircuitBreaker] Hard safety reset — circuit open too long, force-closing', {
        openDurationMs: elapsed,
        maxOpenDurationMs: this.maxOpenDurationMs,
        consecutiveFailures: this.consecutiveFailures,
      });
      this.state = 'CLOSED';
      this.consecutiveFailures = 0;
      this.probeInProgress = false;
      this.currentCooldownMs = this.baseCooldownMs;
      return true;
    }

    if (elapsed >= this.currentCooldownMs) {
      // Cooldown expired — transition to HALF_OPEN, allow one probe call
      if (!this.probeInProgress) {
        this.state = 'HALF_OPEN';
        this.probeInProgress = true;
        logger.info('[LLMCircuitBreaker] Cooldown expired, allowing probe call', {
          cooldownMs: this.currentCooldownMs,
          consecutiveFailures: this.consecutiveFailures,
        });
        return true;
      }
      // Another probe is already in progress — block
      return false;
    }

    // Still in cooldown
    return false;
  }

  /**
   * Record a successful LLM call. Resets the circuit to CLOSED.
   */
  recordSuccess(): void {
    if (this.state !== 'CLOSED') {
      logger.info('[LLMCircuitBreaker] Probe succeeded, closing circuit', {
        previousState: this.state,
        consecutiveFailures: this.consecutiveFailures,
      });
    }
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.probeInProgress = false;
    this.currentCooldownMs = this.baseCooldownMs;
  }

  /**
   * Record a rate limit / quota error. Trips (or re-trips) the circuit.
   * Also notifies ModelFactory to blacklist the failing provider so that
   * subsequent getModel() calls fall back to the next available provider.
   */
  recordRateLimitError(error?: unknown): void {
    this.consecutiveFailures++;
    this.trippedAt = Date.now();
    this.state = 'OPEN';
    this.probeInProgress = false;

    // Exponential backoff: double cooldown on each consecutive trip, cap at max
    this.currentCooldownMs = Math.min(
      this.baseCooldownMs * Math.pow(2, this.consecutiveFailures - 1),
      this.maxCooldownMs
    );

    // Tell ModelFactory to blacklist the current provider for the cooldown duration
    // so getModel() returns a model from the next available provider
    modelFactory.markCurrentProviderRateLimited(this.currentCooldownMs);

    const hasOtherProviders = modelFactory.hasAvailableProviders();

    logger.warn(`[LLMCircuitBreaker] Circuit OPEN — ${hasOtherProviders ? 'falling back to other providers' : 'blocking all LLM calls'}`, {
      consecutiveFailures: this.consecutiveFailures,
      cooldownMs: this.currentCooldownMs,
      cooldownMinutes: Math.round(this.currentCooldownMs / 60000),
      hasOtherProviders,
      activeProvider: modelFactory.getActiveProvider(),
      error: error instanceof Error ? error.message : undefined,
    });
  }

  /**
   * Check if an error is a rate limit / quota exceeded error.
   */
  isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('too many requests') ||
        message.includes('insufficient balance') ||
        message.includes('exceeded your current quota') ||
        message.includes('402')
      );
    }
    return false;
  }

  /**
   * Force-reset the circuit breaker to CLOSED state.
   * Used by admin/health endpoints when manual intervention is needed.
   */
  forceReset(): void {
    const previousState = this.state;
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.probeInProgress = false;
    this.currentCooldownMs = this.baseCooldownMs;
    logger.info('[LLMCircuitBreaker] Force reset by admin', { previousState });
  }

  /**
   * Get current circuit state for logging/monitoring.
   */
  getStatus(): { state: CircuitState; consecutiveFailures: number; cooldownMs: number; cooldownRemaining: number } {
    const remaining = this.state === 'OPEN'
      ? Math.max(0, this.currentCooldownMs - (Date.now() - this.trippedAt))
      : 0;

    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      cooldownMs: this.currentCooldownMs,
      cooldownRemaining: remaining,
    };
  }
}

export const llmCircuitBreaker = new LLMCircuitBreakerService();
