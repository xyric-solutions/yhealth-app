/**
 * @file Workout Logger
 * Structured logging for workout operations and AI generation
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  planId?: string;
  provider?: string;
  duration?: number;
  exerciseCount?: number;
  [key: string]: unknown;
}

// Environment check for development mode
const isDev = process.env.NODE_ENV === 'development';

// Color codes for console logs
const LOG_COLORS = {
  info: '#3b82f6',    // blue
  warn: '#f59e0b',    // amber
  error: '#ef4444',   // red
  debug: '#8b5cf6',   // purple
};

/**
 * Structured logger for workout operations
 */
class WorkoutLogger {
  private prefix = '[Workouts]';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Log info messages
   */
  info(message: string, context?: LogContext): void {
    if (isDev) {
      console.log(
        `%c${this.prefix} ${message}`,
        `color: ${LOG_COLORS.info}; font-weight: bold;`,
        context || ''
      );
    } else {
      console.log(this.formatMessage('info', message, context));
    }
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    if (isDev) {
      console.warn(
        `%c${this.prefix} ${message}`,
        `color: ${LOG_COLORS.warn}; font-weight: bold;`,
        context || ''
      );
    } else {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  /**
   * Log error messages
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { error: String(error) };

    const fullContext = { ...context, ...errorDetails };

    if (isDev) {
      console.error(
        `%c${this.prefix} ${message}`,
        `color: ${LOG_COLORS.error}; font-weight: bold;`,
        fullContext
      );
    } else {
      console.error(this.formatMessage('error', message, fullContext));
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      console.debug(
        `%c${this.prefix} ${message}`,
        `color: ${LOG_COLORS.debug}; font-weight: bold;`,
        context || ''
      );
    }
  }

  /**
   * Log AI generation events
   */
  logAIGeneration(event: 'start' | 'success' | 'error' | 'fallback', context: LogContext): void {
    const messages = {
      start: 'Starting AI generation',
      success: 'AI generation completed successfully',
      error: 'AI generation failed',
      fallback: 'Using fallback (non-AI) generation',
    };

    if (event === 'error') {
      this.error(messages[event], undefined, { ...context, aiEvent: event });
    } else if (event === 'fallback') {
      this.warn(messages[event], { ...context, aiEvent: event });
    } else {
      this.info(messages[event], { ...context, aiEvent: event });
    }
  }

  /**
   * Log API operations
   */
  logAPI(operation: 'create' | 'update' | 'delete' | 'fetch', resource: string, context: LogContext & { success: boolean }): void {
    const { success, ...rest } = context;
    const message = `API ${operation} ${resource} - ${success ? 'SUCCESS' : 'FAILED'}`;

    if (success) {
      this.info(message, rest);
    } else {
      this.error(message, undefined, rest);
    }
  }

  /**
   * Log workout session events
   */
  logSession(event: 'start' | 'pause' | 'resume' | 'complete' | 'cancel', context?: LogContext): void {
    const messages = {
      start: 'Workout session started',
      pause: 'Workout session paused',
      resume: 'Workout session resumed',
      complete: 'Workout session completed',
      cancel: 'Workout session cancelled',
    };

    this.info(messages[event], { ...context, sessionEvent: event });
  }
}

// Export singleton instance
export const workoutLogger = new WorkoutLogger();
