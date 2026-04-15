import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env.config.js';
import { logger } from '../services/logger.service.js';

interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
  onConnected?: () => void;
  onError?: (error: Error) => void;
  onDisconnected?: () => void;
}

// Parse DATABASE_URL into individual connection params
function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

// Database configuration - prefer DATABASE_URL, fall back to individual vars
const dbConfig = process.env['DATABASE_URL']
  ? {
      ...parseConnectionString(process.env['DATABASE_URL']),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT_MS'] || '10000', 10),
    }
  : {
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432', 10),
      database: process.env['DB_NAME'] || 'balencia',
      user: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'] || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT_MS'] || '10000', 10),
    };

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private isConnected = false;
  private retryCount = 0;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  private constructor(options: ConnectionOptions = {}) {
    this.maxRetries = options.maxRetries ?? 5;
    this.retryDelay = options.retryDelay ?? 5000;

    // Initialize PostgreSQL Pool
    this.pool = new Pool(dbConfig);

    this.setupEventHandlers();
  }

  public static getInstance(options?: ConnectionOptions): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(options);
    }
    return DatabaseConnection.instance;
  }

  private setupEventHandlers(): void {
    // Log connections and set timezone to UTC for consistent timestamps
    this.pool.on('connect', async (client) => {
      // Set timezone to UTC to ensure all timestamps are stored consistently
      await client.query("SET timezone = 'UTC'");
      logger.debug('New PostgreSQL client connected (timezone set to UTC)');
    });

    // Log errors
    this.pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
      this.isConnected = false;
      if (this.retryCount < this.maxRetries) {
        this.scheduleReconnect();
      }
    });

    // Handle process termination
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  private scheduleReconnect(): void {
    this.retryCount++;
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);

    logger.info(`Scheduling reconnect attempt ${this.retryCount}/${this.maxRetries} in ${delay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection attempt failed', {
          attempt: this.retryCount,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, delay);
  }

  public async connect(): Promise<Pool> {
    if (this.isConnected) {
      logger.debug('Already connected to PostgreSQL');
      return this.pool;
    }

    try {
      logger.info('Connecting to PostgreSQL...', {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
      });

      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      this.retryCount = 0;

      logger.info('PostgreSQL connected successfully', {
        timestamp: result.rows[0].now,
      });

      // Note: Database migrations should be run manually via:
      // - npm run db:setup (for full schema setup)
      // - Custom migration scripts (for incremental migrations)
      // Auto-migration is disabled to prevent unexpected schema changes on startup

      return this.pool;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to connect to PostgreSQL', { error: errorMessage });

      if (this.retryCount < this.maxRetries) {
        this.scheduleReconnect();
      } else {
        throw new Error(`Failed to connect to PostgreSQL after ${this.maxRetries} attempts: ${errorMessage}`);
      }

      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug('Already disconnected from PostgreSQL');
      return;
    }

    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Closing PostgreSQL connection...`);

    try {
      await this.disconnect();
      logger.info('PostgreSQL connection closed due to app termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public getConnectionStatus(): {
    isConnected: boolean;
    database: string;
  } {
    return {
      isConnected: this.isConnected,
      database: 'PostgreSQL',
    };
  }

  public async healthCheck(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
    const startTime = Date.now();

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      const latency = Date.now() - startTime;

      this.isConnected = true;
      return { status: 'up', latency };
    } catch (error) {
      this.isConnected = false;
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  /**
   * Execute a query with parameters
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: (string | number | boolean | null | Date | object)[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (env.isDevelopment) {
        logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
      }
      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorCode = (error as any)?.code;
      
      // Check if this is a known pgvector missing error (non-critical, has fallback)
      const isVectorExtensionError = 
        errorCode === '42704' || // type does not exist
        errorCode === '58P01' || // extension not available
        errorCode === '0A000' || // feature not supported (extension not available)
        errorMessage?.includes('type "vector" does not exist') ||
        errorMessage?.includes('extension "vector" is not available') ||
        errorMessage?.includes('extension "vector" does not exist') ||
        (errorMessage?.includes('vector') && errorMessage?.includes('does not exist')) ||
        (errorMessage?.includes('extension') && errorMessage?.includes('not available'));
      
      if (isVectorExtensionError) {
        // Log as debug instead of error since we have fallback handling
        logger.debug('Query error (pgvector extension not available, fallback will be used)', { 
          text: text.substring(0, 100), 
          error: errorMessage 
        });
      } else {
        logger.error('Query error', { text: text.substring(0, 100), error: errorMessage });
      }
      throw error;
    }
  }

  /**
   * Get a client from the pool for transaction support
   */
  public async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect();
    // Ensure timezone is set to UTC for this client
    await client.query("SET timezone = 'UTC'");
    return client;
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      // Ensure timezone is set to UTC for this transaction
      await client.query("SET timezone = 'UTC'");
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

export const database = DatabaseConnection.getInstance();

// Export convenience functions
export const query = database.query.bind(database);
export const transaction = database.transaction.bind(database);
export const getClient = database.getClient.bind(database);

export default database;
