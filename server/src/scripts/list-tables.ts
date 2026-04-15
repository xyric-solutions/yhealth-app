#!/usr/bin/env node
/**
 * List all tables in the database
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function listTables() {
  const pool = new Pool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'balencia',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  });

  try {
    console.log('🔌 Connecting to database...\n');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📊 Found ${result.rows.length} tables:\n`);
    
    // Group tables by category
    const tables = result.rows.map(r => r.table_name);
    const gamificationTables = tables.filter(t => 
      ['variable_rewards', 'daily_pledges', 'teams', 'team_members', 'achievement_definitions', 'user_achievements'].includes(t)
    );
    const otherMissing = tables.filter(t => 
      ['newsletter_subscriptions', 'user_roles'].includes(t)
    );
    
    console.log('✅ Gamification Tables:');
    if (gamificationTables.length > 0) {
      gamificationTables.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log('   (none found)');
    }
    
    console.log('\n✅ Newsletter/Roles Tables:');
    if (otherMissing.length > 0) {
      otherMissing.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log('   (none found)');
    }
    
    console.log('\n📋 All Tables:');
    tables.forEach(t => console.log(`   - ${t}`));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listTables();
