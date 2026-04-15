import { Pool, PoolClient, QueryResult, QueryResultRow, types } from "pg";
import { logger } from "../services/logger.service.js";

// Prevent DATE columns from being converted to JS Date objects (which causes
// timezone shifts when .toISOString() is called). PostgreSQL DATE is timezone-free
// "YYYY-MM-DD" — return it as-is to avoid off-by-one day bugs in non-UTC servers.
types.setTypeParser(1082, (val: string) => val);

// Parse DATABASE_URL into individual connection params
function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "5432", 10),
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

// Database configuration - prefer DATABASE_URL, fall back to individual vars
// Pool size: 30 connections to handle concurrent context queries (16 sub-methods batched in 4 waves of 4)
// Connection timeout: 5 seconds — fail fast to prevent cascading waits
// Statement timeout: 15 seconds to prevent long-running queries from holding connections
const dbConfig = process.env["DATABASE_URL"]
  ? {
      ...parseConnectionString(process.env["DATABASE_URL"]),
      max: parseInt(process.env["DB_POOL_MAX"] || "30", 10),
      idleTimeoutMillis: parseInt(process.env["DB_IDLE_TIMEOUT_MS"] || "30000", 10),
      connectionTimeoutMillis: parseInt(process.env["DB_CONNECTION_TIMEOUT_MS"] || "5000", 10),
      statement_timeout: parseInt(process.env["DB_STATEMENT_TIMEOUT_MS"] || "15000", 10),
    }
  : {
      host: process.env["DB_HOST"] || "localhost",
      port: parseInt(process.env["DB_PORT"] || "5432", 10),
      database: process.env["DB_NAME"] || "balencia",
      user: process.env["DB_USER"] || "postgres",
      password: process.env["DB_PASSWORD"] || "",
      max: parseInt(process.env["DB_POOL_MAX"] || "30", 10),
      idleTimeoutMillis: parseInt(process.env["DB_IDLE_TIMEOUT_MS"] || "30000", 10),
      connectionTimeoutMillis: parseInt(process.env["DB_CONNECTION_TIMEOUT_MS"] || "5000", 10),
      statement_timeout: parseInt(process.env["DB_STATEMENT_TIMEOUT_MS"] || "15000", 10),
    };

// Create the connection pool
const pool = new Pool(dbConfig);

// Set timezone to UTC for all connections to ensure consistent timestamps
// Also set statement timeout to prevent long-running queries
pool.on("connect", async (client) => {
  try {
    // Set timezone to UTC to ensure all timestamps are stored consistently
    await client.query("SET timezone = 'UTC'");
    // Set statement timeout (in milliseconds) to prevent queries from running too long
    const statementTimeout = dbConfig.statement_timeout || 30000;
    await client.query(`SET statement_timeout = ${statementTimeout}`);
    logger.debug("New PostgreSQL client connected (timezone and statement_timeout set)", {
      statementTimeout,
    });
  } catch (error) {
    // Downgraded from ERROR to DEBUG — Railway often terminates idle connections,
    // causing SET timezone/statement_timeout to fail on dead connections.
    // The pool automatically creates new connections, so this is non-fatal.
    logger.debug("Connection setup failed (pool will retry with new connection)", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Don't throw - allow connection to proceed even if these settings fail
  }
});

pool.on("error", (err) => {
  logger.error("PostgreSQL pool error", { error: err.message });
});

/**
 * Execute a query with parameters
 * Includes retry logic for connection timeouts
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null | Date | object)[],
  retries: number = 2
): Promise<QueryResult<T>> {
  const start = Date.now();
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      if (attempt > 0) {
        logger.info("Query succeeded after retry", {
          attempt: attempt + 1,
          duration,
          text: text.substring(0, 100),
        });
      } else {
        logger.debug("Executed query", {
          text: text.substring(0, 100),
          duration,
          rows: result.rowCount,
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message;
      const errorCode = (error as any)?.code;
      
      // Check if this is a connection timeout or connection error that we should retry
      const isConnectionError = 
        errorMessage?.includes('Connection terminated') ||
        errorMessage?.includes('connection timeout') ||
        errorMessage?.includes('Connection terminated due to connection timeout') ||
        errorCode === '57P01' || // Admin shutdown
        errorCode === '57P02' || // Crash shutdown
        errorCode === '57P03';   // Cannot connect now
      
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
        logger.debug("Query error (pgvector extension not available, fallback will be used)", {
          text: text.substring(0, 100),
          error: errorMessage,
          errorCode,
        });
        throw error;
      }
      
      // Retry connection errors
      if (isConnectionError && attempt < retries) {
        const delay = Math.min(100 * Math.pow(2, attempt), 1000); // Exponential backoff, max 1s
        logger.warn("Query connection error, retrying", {
          attempt: attempt + 1,
          maxRetries: retries + 1,
          delay,
          error: errorMessage,
          errorCode,
          text: text.substring(0, 100),
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Log error for non-retryable errors or final attempt
      logger.error("Query error", {
        text: text.substring(0, 200), // Show more of query for debugging
        error: errorMessage,
        errorCode,
        fullQuery: text, // Include full query in error log
        attempt: attempt + 1,
        poolStats: getPoolStats(),
      });
      throw error;
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Query failed after retries");
}

/**
 * Get a client from the pool for transaction support
 */
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  // Ensure timezone is set to UTC for this client
  await client.query("SET timezone = 'UTC'");
  return client;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // Ensure timezone is set to UTC for this transaction
    await client.query("SET timezone = 'UTC'");
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query("SELECT NOW()");
    logger.info("PostgreSQL connected successfully", {
      timestamp: result.rows[0].now,
    });
    return true;
  } catch (error) {
    logger.error("PostgreSQL connection failed", {
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Close all pool connections
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("PostgreSQL pool closed");
}

/**
 * Get pool statistics
 */
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

// Export the pool for direct access if needed
export { pool };

// Default export
export default {
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  getPoolStats,
  pool,
};
