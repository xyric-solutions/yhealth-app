import { query, closePool } from './pg.js';

async function migrate() {
  console.log('Starting group chat features migration...');

  try {
    // Add join_code column
    await query('ALTER TABLE chats ADD COLUMN IF NOT EXISTS join_code VARCHAR(6)');
    console.log('✅ Added join_code column');

    // Add join_code_expires_at column
    await query('ALTER TABLE chats ADD COLUMN IF NOT EXISTS join_code_expires_at TIMESTAMP');
    console.log('✅ Added join_code_expires_at column');

    // Add created_by column
    await query('ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL');
    console.log('✅ Added created_by column');

    // Add message_permission_mode column
    await query("ALTER TABLE chats ADD COLUMN IF NOT EXISTS message_permission_mode VARCHAR(20) DEFAULT 'all'");
    console.log('✅ Added message_permission_mode column');

    // Add allowed_sender_ids column
    await query("ALTER TABLE chats ADD COLUMN IF NOT EXISTS allowed_sender_ids UUID[] DEFAULT '{}'");
    console.log('✅ Added allowed_sender_ids column');

    // Create unique constraint on join_code (if it doesn't exist)
    try {
      await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_join_code_unique ON chats(join_code) WHERE join_code IS NOT NULL');
      console.log('✅ Created unique index on join_code');
    } catch (e: any) {
      // Index might already exist, that's okay
      if (!e.message?.includes('already exists')) {
        throw e;
      }
      console.log('ℹ️ join_code unique index already exists');
    }

    // Create index on join_code for lookups
    await query('CREATE INDEX IF NOT EXISTS idx_chats_join_code ON chats(join_code) WHERE join_code IS NOT NULL');
    console.log('✅ Created index on join_code');

    console.log('\n🎉 Group chat features migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

migrate();

