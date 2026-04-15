/**
 * @file Ensure Admin Has All Permissions
 * Script to assign all existing permissions to the admin role
 * This ensures admin always has access to everything, including newly added permissions
 */

import 'dotenv/config';
import { Pool } from 'pg';

const ADMIN_ROLE_ID = '11111111-1111-1111-1111-111111111102'; // Admin role UUID

async function ensureAdminHasAllPermissions() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');

    const client = await pool.connect();

    try {
      // Check if admin role exists
      const roleCheck = await client.query(
        'SELECT id, name, slug FROM roles WHERE id = $1',
        [ADMIN_ROLE_ID]
      );

      if (roleCheck.rows.length === 0) {
        console.error('❌ Admin role not found!');
        console.error('   Please run the role-permissions migration first.');
        process.exit(1);
      }

      const adminRole = roleCheck.rows[0];
      console.log(`📋 Found admin role: ${adminRole.name} (${adminRole.slug})\n`);

      // Get all permissions
      const permissionsResult = await client.query(
        'SELECT id, slug, name, resource, action FROM permissions ORDER BY resource, action'
      );
      const allPermissions = permissionsResult.rows;
      console.log(`📝 Found ${allPermissions.length} permissions\n`);

      // Get current admin permissions
      const currentPermissionsResult = await client.query(
        'SELECT permission_id FROM role_permissions WHERE role_id = $1',
        [ADMIN_ROLE_ID]
      );
      const currentPermissionIds = new Set(
        currentPermissionsResult.rows.map((r: { permission_id: string }) => r.permission_id)
      );
      console.log(`🔐 Admin currently has ${currentPermissionIds.size} permissions\n`);

      // Find missing permissions
      const missingPermissions = allPermissions.filter(
        (p) => !currentPermissionIds.has(p.id)
      );

      if (missingPermissions.length === 0) {
        console.log('✅ Admin already has all permissions!\n');
        return;
      }

      console.log(`➕ Adding ${missingPermissions.length} missing permissions:\n`);

      // Add missing permissions
      for (const perm of missingPermissions) {
        try {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT (role_id, permission_id) DO NOTHING',
            [ADMIN_ROLE_ID, perm.id]
          );
          console.log(`   ✅ ${perm.slug} (${perm.resource}.${perm.action})`);
        } catch (err: any) {
          console.error(`   ❌ Failed to add ${perm.slug}:`, err.message);
        }
      }

      // Verify final count
      const finalResult = await client.query(
        'SELECT COUNT(*) as count FROM role_permissions WHERE role_id = $1',
        [ADMIN_ROLE_ID]
      );
      const finalCount = parseInt(finalResult.rows[0].count, 10);

      console.log(`\n🎉 Done! Admin now has ${finalCount} permissions (${allPermissions.length} total available)\n`);

      // Also ensure admin role is active
      await client.query(
        'UPDATE roles SET is_active = true WHERE id = $1',
        [ADMIN_ROLE_ID]
      );
      console.log('✅ Ensured admin role is active\n');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

ensureAdminHasAllPermissions()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

