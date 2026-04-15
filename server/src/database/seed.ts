import bcrypt from 'bcryptjs';
import { query, closePool } from './pg.js';

interface UserRow {
  id: string;
  email: string;
}

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Check if user already exists
    const existingUser = await query<UserRow>(
      'SELECT id, email FROM users WHERE email = $1',
      ['salman@xyric.ai']
    );

    if (existingUser.rows.length > 0) {
      console.log('✅ User salman@xyric.ai already exists');
      console.log(`   User ID: ${existingUser.rows[0].id}`);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('salman121', salt);

    // Create user
    const userResult = await query<UserRow>(
      `INSERT INTO users (
        email, password, first_name, last_name, date_of_birth, gender,
        auth_provider, onboarding_status, is_email_verified, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email`,
      [
        'salman@xyric.ai',
        hashedPassword,
        'Salman',
        'Test',
        new Date('1990-01-15'),
        'male',
        'local',
        'consent_pending',
        true,
        true,
      ]
    );

    const userId = userResult.rows[0].id;
    console.log('✅ User created successfully');
    console.log(`   Email: salman@xyric.ai`);
    console.log(`   Password: salman121`);
    console.log(`   User ID: ${userId}`);

    // Create default preferences for the user
    await query(
      'INSERT INTO user_preferences (user_id) VALUES ($1)',
      [userId]
    );
    console.log('✅ User preferences created');

    // Add consent records (terms and privacy)
    await query(
      `INSERT INTO consent_records (user_id, type, version, ip)
       VALUES ($1, 'terms_of_service', '1.0.0', '127.0.0.1'),
              ($1, 'privacy_policy', '1.0.0', '127.0.0.1')`,
      [userId]
    );
    console.log('✅ Consent records created');

    // Update onboarding status to assessment_pending
    await query(
      'UPDATE users SET onboarding_status = $1 WHERE id = $2',
      ['assessment_pending', userId]
    );
    console.log('✅ Onboarding status updated to assessment_pending');

    // Assign admin role
    const ADMIN_ROLE_ID = '11111111-1111-1111-1111-111111111102';
    await query(
      'UPDATE users SET role_id = $1 WHERE id = $2',
      [ADMIN_ROLE_ID, userId]
    );
    await query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, ADMIN_ROLE_ID]
    );
    console.log('✅ Admin role assigned');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Test User Credentials:');
    console.log('   Email: salman@xyric.ai');
    console.log('   Password: salman121');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Run seed
seed().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
