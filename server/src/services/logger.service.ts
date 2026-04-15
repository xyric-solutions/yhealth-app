import { env } from '../config/env.config.js';
import type { LogLevel } from '../types/index.js';

interface LogMeta {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: LogMeta;
  requestId?: string;
  userId?: string;
  service?: string;
}

class Logger {
  private static instance: Logger;
  private readonly serviceName: string;
  private readonly logLevel: LogLevel;
  private readonly levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  };

  private constructor() {
    this.serviceName = 'balencia-api';
    this.logLevel = (env.logging.level as LogLevel) || 'info';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const base = {
      timestamp: entry.timestamp,
      level: entry.level.toUpperCase(),
      service: this.serviceName,
      message: entry.message,
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.meta && Object.keys(entry.meta).length > 0 && { meta: entry.meta }),
    };

    if (env.isProduction) {
      return JSON.stringify(base);
    }

    // Development format - colorized and readable
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      http: '\x1b[35m',  // Magenta
      debug: '\x1b[90m', // Gray
      reset: '\x1b[0m',
    };

    const color = colors[entry.level];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelPadded = entry.level.toUpperCase().padEnd(5);

    let output = `${colors.debug}${timestamp}${colors.reset} ${color}${levelPadded}${colors.reset} ${entry.message}`;

    if (entry.meta && Object.keys(entry.meta).length > 0) {
      output += ` ${colors.debug}${JSON.stringify(entry.meta)}${colors.reset}`;
    }

    return output;
  }

  private log(level: LogLevel, message: string, meta?: LogMeta): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      meta,
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  public error(message: string, meta?: LogMeta): void {
    this.log('error', message, meta);
  }

  public warn(message: string, meta?: LogMeta): void {
    this.log('warn', message, meta);
  }

  public info(message: string, meta?: LogMeta): void {
    this.log('info', message, meta);
  }

  public http(message: string, meta?: LogMeta): void {
    this.log('http', message, meta);
  }

  public debug(message: string, meta?: LogMeta): void {
    this.log('debug', message, meta);
  }

  // Express morgan stream
  public stream = {
    write: (message: string): void => {
      this.http(message.trim());
    },
  };

  // Child logger with context
  public child(context: LogMeta): {
    error: (message: string, meta?: LogMeta) => void;
    warn: (message: string, meta?: LogMeta) => void;
    info: (message: string, meta?: LogMeta) => void;
    http: (message: string, meta?: LogMeta) => void;
    debug: (message: string, meta?: LogMeta) => void;
  } {
    return {
      error: (message: string, meta?: LogMeta) => this.error(message, { ...context, ...meta }),
      warn: (message: string, meta?: LogMeta) => this.warn(message, { ...context, ...meta }),
      info: (message: string, meta?: LogMeta) => this.info(message, { ...context, ...meta }),
      http: (message: string, meta?: LogMeta) => this.http(message, { ...context, ...meta }),
      debug: (message: string, meta?: LogMeta) => this.debug(message, { ...context, ...meta }),
    };
  }
}

export const logger = Logger.getInstance();
export default logger;
