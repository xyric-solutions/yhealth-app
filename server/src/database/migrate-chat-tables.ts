/**
 * @file Chat Tables Migration Script
 * @description Safely migrates chat/messaging tables without removing existing data
 */

import 'dotenv/config';
import { pool, query } from './pg.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Table files in dependency order
const CHAT_TABLE_FILES = [
  '38-chats.sql',
  '39-messages.sql',
  '40-chat-participants.sql',
  '41-message-reactions.sql',
  '42-message-reads.sql',
  '43-starred-messages.sql',
];

interface TableStatus {
  name: string;
  exists: boolean;
  created: boolean;
}

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0]?.exists || false;
  } catch (error) {
    logger.error(`Error checking if table ${tableName} exists`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Execute SQL file safely
 */
async function executeSqlFile(filePath: string, tableName: string): Promise<boolean> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Split by semicolons but handle DO blocks
    const statements: string[] = [];
    let currentStatement = '';
    let inDollarQuote = false;
    let dollarTag = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      // Check for dollar quote start
      if (char === '$' && !inDollarQuote) {
        let tagEnd = i + 1;
        while (tagEnd < content.length && content[tagEnd] !== '$') {
          tagEnd++;
        }
        if (tagEnd < content.length) {
          dollarTag = content.substring(i, tagEnd + 1);
          inDollarQuote = true;
          currentStatement += dollarTag;
          i = tagEnd;
          continue;
        }
      }
      
      // Check for dollar quote end
      if (inDollarQuote && char === '$') {
        const potentialEnd = content.substring(i, i + dollarTag.length);
        if (potentialEnd === dollarTag) {
          inDollarQuote = false;
          currentStatement += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = '';
          continue;
        }
      }
      
      currentStatement += char;
      
      // Statement boundary
      if (char === ';' && !inDollarQuote) {
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('--')) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }
    
    // Add remaining statement
    if (currentStatement.trim().length > 0 && !currentStatement.trim().startsWith('--')) {
      statements.push(currentStatement.trim());
    }
    
    // Execute each statement
    for (const stmt of statements) {
      const upperStmt = stmt.toUpperCase();
      
      // Skip DROP TABLE statements to preserve data
      if (upperStmt.includes('DROP TABLE')) {
        logger.debug(`Skipping DROP statement in ${filePath}`);
        continue;
      }
      
      // Skip if it's a CREATE TABLE and table already exists
      if (upperStmt.startsWith('CREATE TABLE') && !upperStmt.includes('IF NOT EXISTS')) {
        if (await tableExists(tableName)) {
          logger.info(`Table ${tableName} already exists, skipping CREATE TABLE`);
          continue;
        }
        // Convert to CREATE TABLE IF NOT EXISTS
        const modifiedStmt = stmt.replace(/CREATE TABLE\s+(\w+)/i, 'CREATE TABLE IF NOT EXISTS $1');
        try {
          await query(modifiedStmt);
          logger.info(`Created table ${tableName}`);
        } catch (err: any) {
          if (err?.code === '42P07' || err?.message?.includes('already exists')) {
            logger.debug(`Table ${tableName} already exists (safe to ignore)`);
          } else {
            throw err;
          }
        }
      } else {
        // Execute other statements (indexes, constraints, etc.)
        try {
          await query(stmt);
        } catch (err: any) {
          // Ignore "already exists" errors for indexes and constraints
          if (
            err?.code === '42P07' ||
            err?.code === '42710' ||
            err?.code === '23505' ||
            err?.message?.includes('already exists') ||
            err?.message?.includes('duplicate')
          ) {
            logger.debug(`Object already exists (safe to ignore): ${stmt.substring(0, 50)}...`);
            continue;
          }
          // Ignore constraint already exists errors
          if (err?.code === '42701' && err?.message?.includes('constraint')) {
            logger.debug(`Constraint already exists (safe to ignore)`);
            continue;
          }
          throw err;
        }
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error executing SQL file ${filePath}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateChatTables(): Promise<void> {
  console.log('🌱 Starting chat tables migration...\n');

  try {
    // Verify database connection
    await query('SELECT 1');
    console.log('✅ Database connection verified\n');

    const tablesDir = join(__dirname, 'tables');
    const statuses: TableStatus[] = [];

    // Check existing tables
    console.log('📊 Checking existing tables...');
    for (const file of CHAT_TABLE_FILES) {
      const tableName = file
        .replace(/^\d+-/, '')
        .replace(/\.sql$/, '')
        .replace(/-/g, '_');
      
      const exists = await tableExists(tableName);
      statuses.push({ name: tableName, exists, created: false });
      console.log(`  ${exists ? '✓' : '✗'} ${tableName} ${exists ? '(exists)' : '(missing)'}`);
    }

    const missingTables = statuses.filter(s => !s.exists);
    
    if (missingTables.length === 0) {
      console.log('\n✅ All chat tables already exist. Migration not needed.');
      return;
    }

    console.log(`\n📦 Creating ${missingTables.length} missing table(s)...\n`);

    // Execute migrations in order
    for (const file of CHAT_TABLE_FILES) {
      const tableName = file
        .replace(/^\d+-/, '')
        .replace(/\.sql$/, '')
        .replace(/-/g, '_');
      
      const filePath = join(tablesDir, file);
      
      if (!statuses.find(s => s.name === tableName)?.exists) {
        console.log(`Creating ${tableName}...`);
        try {
          await executeSqlFile(filePath, tableName);
          const status = statuses.find(s => s.name === tableName);
          if (status) {
            status.created = true;
          }
          console.log(`  ✅ ${tableName} created successfully`);
        } catch (error) {
          console.error(`  ❌ Failed to create ${tableName}:`, error);
          throw error;
        }
      } else {
        console.log(`  ⏭️  ${tableName} already exists, skipping`);
      }
    }

    // Verify all tables were created
    console.log('\n🔍 Verifying migration...');
    const finalStatuses: TableStatus[] = [];
    for (const file of CHAT_TABLE_FILES) {
      const tableName = file
        .replace(/^\d+-/, '')
        .replace(/\.sql$/, '')
        .replace(/-/g, '_');
      
      const exists = await tableExists(tableName);
      finalStatuses.push({ name: tableName, exists, created: false });
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    }

    const stillMissing = finalStatuses.filter(s => !s.exists);
    if (stillMissing.length > 0) {
      throw new Error(`Failed to create tables: ${stillMissing.map(s => s.name).join(', ')}`);
    }

    console.log('\n🎉 Chat tables migration completed successfully!');
    console.log(`\n📋 Migrated Tables:`);
    finalStatuses.forEach(status => {
      console.log(`   • ${status.name}`);
    });

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    logger.error('Chat tables migration failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateChatTables()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { migrateChatTables };

