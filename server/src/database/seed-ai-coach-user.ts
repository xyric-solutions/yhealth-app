/**
 * @file Seed AI Coach System User
 * @description Creates the AI Coach system user for schedule automation messages
 *
 * The AI Coach is a special system user that sends automated messages based on
 * user schedules. This user should have a fixed UUID that matches AI_COACH_USER_ID
 * in the environment configuration.
 */

import { query, closePool } from './pg.js';

// Fixed UUID for AI Coach - must match AI_COACH_USER_ID in .env
const AI_COACH_USER_ID = '00000000-0000-0000-0000-000000000001';
const AI_COACH_EMAIL = 'ai-coach@balencia.system';

interface UserRow {
  id: string;
  email: string;
}

async function seedAICoachUser() {
  console.log('🤖 Starting AI Coach user seed...\n');

  try {
    // Check if AI Coach user already exists
    const existingUser = await query<UserRow>(
      'SELECT id, email FROM users WHERE id = $1 OR email = $2',
      [AI_COACH_USER_ID, AI_COACH_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      console.log('✅ AI Coach user already exists');
      console.log(`   User ID: ${existingUser.rows[0].id}`);
      console.log(`   Email: ${existingUser.rows[0].email}`);
      return;
    }

    // Create AI Coach system user with fixed UUID
    const userResult = await query<UserRow>(
      `INSERT INTO users (
        id, email, password, first_name, last_name,
        auth_provider, onboarding_status, is_email_verified, is_active, role_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email`,
      [
        AI_COACH_USER_ID,
        AI_COACH_EMAIL,
        'SYSTEM_USER_NO_LOGIN', // Not a real password - system users can't log in
        'AI',
        'Coach',
        'system', // Special auth provider for system users
        'completed',
        true,
        true,
        '11111111-1111-1111-1111-111111111106', // System role_id
      ]
    );

    console.log('✅ AI Coach user created successfully');
    console.log(`   User ID: ${userResult.rows[0].id}`);
    console.log(`   Email: ${userResult.rows[0].email}`);
    console.log(`   Name: AI Coach`);

    // Create default preferences for AI Coach
    await query(
      `INSERT INTO user_preferences (user_id, timezone)
       VALUES ($1, 'UTC')
       ON CONFLICT (user_id) DO NOTHING`,
      [AI_COACH_USER_ID]
    );
    console.log('✅ AI Coach preferences created');

    console.log('\n🎉 AI Coach user seed completed successfully!');
    console.log('\n📋 AI Coach Details:');
    console.log(`   User ID: ${AI_COACH_USER_ID}`);
    console.log(`   Email: ${AI_COACH_EMAIL}`);
    console.log('   Note: Add AI_COACH_USER_ID to your .env file');

  } catch (error) {
    console.error('❌ AI Coach seed failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Run seed
seedAICoachUser().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
