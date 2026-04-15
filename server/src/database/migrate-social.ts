import { query, closePool } from './pg.js';

async function migrate() {
  console.log('Starting migration...');

  try {
    // Add provider_id column if not exists
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255)');
    console.log('✅ Added provider_id column');

    // Make date_of_birth nullable
    try {
      await query('ALTER TABLE users ALTER COLUMN date_of_birth DROP NOT NULL');
      console.log('✅ Made date_of_birth nullable');
    } catch (_e) {
      console.log('ℹ️ date_of_birth already nullable');
    }

    // Make gender nullable
    try {
      await query('ALTER TABLE users ALTER COLUMN gender DROP NOT NULL');
      console.log('✅ Made gender nullable');
    } catch (_e) {
      console.log('ℹ️ gender already nullable');
    }

    // Create index for provider lookup
    await query('CREATE INDEX IF NOT EXISTS idx_users_provider ON users(auth_provider, provider_id)');
    console.log('✅ Created provider index');

    // Drop social_profiles table if exists
    await query('DROP TABLE IF EXISTS social_profiles CASCADE');
    console.log('✅ Dropped social_profiles table');

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await closePool();
  }
}

migrate();
