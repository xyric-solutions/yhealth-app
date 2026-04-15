import 'dotenv/config';
import { query, closePool } from './pg.js';

async function makeAdmin() {
  const ADMIN_ROLE_ID = '11111111-1111-1111-1111-111111111102';
  const email = process.argv[2] || 'salman@xyric.ai';

  try {
    const r1 = await query<{ id: string }>(
      'UPDATE users SET role_id = $1 WHERE email = $2 RETURNING id',
      [ADMIN_ROLE_ID, email]
    );

    if (r1.rows.length > 0) {
      const userId = r1.rows[0].id;
      await query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, ADMIN_ROLE_ID]
      );
      console.log(`✅ Admin role assigned to ${email} (user_id: ${userId})`);
    } else {
      console.log(`❌ User ${email} not found`);
    }
  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await closePool();
  }
}

makeAdmin();
