/**
 * @file Community Group Seed Script
 * @description Creates the Balencia Community group and sends a welcome message
 */

import { query, transaction } from './pg.js';
import { logger } from '../services/logger.service.js';

const COMMUNITY_NAME = 'Balencia Community';
const COMMUNITY_AVATAR = 'https://icon-library.com/images/community-icon/community-icon-25.jpg';
const WELCOME_MESSAGE = `Welcome to ${COMMUNITY_NAME}! 👋

This is a space for all Balencia users to connect, share experiences, and support each other on their health and wellness journey.

Feel free to:
• Share your progress and achievements
• Ask questions and get advice
• Support and motivate fellow members
• Discuss health and wellness topics

Let's build a healthy community together! 💪`;

async function seedCommunityGroup(): Promise<void> {
  console.log('🌱 Starting community group seed...\n');

  try {
    // Check if community group already exists
    const existingResult = await query<{ id: string }>(
      `SELECT id FROM chats WHERE is_community = true LIMIT 1`,
      []
    );

    let chatId: string | undefined;

    if (existingResult.rows.length > 0) {
      chatId = existingResult.rows[0].id;
      console.log('✅ Community group already exists');
      console.log(`   Chat ID: ${chatId}`);
    } else {
      // Get first admin user (or create a system user for the group)
      const adminResult = await query<{ id: string }>(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.slug = 'admin' LIMIT 1`,
        []
      );

      let adminId: string | null = null;
      if (adminResult.rows.length > 0) {
        adminId = adminResult.rows[0].id;
      } else {
        // If no admin exists, get first user or null
        const firstUserResult = await query<{ id: string }>(
          `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`,
          []
        );
        if (firstUserResult.rows.length > 0) {
          adminId = firstUserResult.rows[0].id;
        }
      }

      if (!adminId) {
        console.log('⚠️  No users found. Community group will be created when first user registers.');
        return;
      }

      // Create community group in transaction
      await transaction(async (client) => {
        // Create community chat
        const chatResult = await client.query<{ id: string }>(
          `INSERT INTO chats (chat_name, is_group_chat, is_community, avatar, group_admin)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [COMMUNITY_NAME, true, true, COMMUNITY_AVATAR, adminId]
        );

        chatId = chatResult.rows[0].id;
        console.log('✅ Community group created');
        console.log(`   Chat ID: ${chatId}`);
        console.log(`   Name: ${COMMUNITY_NAME}`);

        // Create welcome message
        const messageResult = await client.query<{ id: string }>(
          `INSERT INTO messages (chat_id, sender_id, content, content_type)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [chatId, adminId, WELCOME_MESSAGE, 'text']
        );

        const messageId = messageResult.rows[0].id;

        // Update chat's latest message
        await client.query(
          `UPDATE chats
           SET latest_message_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [messageId, chatId]
        );

        console.log('✅ Welcome message created');
        console.log(`   Message ID: ${messageId}`);
      });
    }

    if (!chatId) {
      console.log('⚠️  Failed to create or retrieve community group.');
      return;
    }

    // Get all users from database
    const allUsersResult = await query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE is_active = true ORDER BY created_at ASC`,
      []
    );

    const allUserIds = allUsersResult.rows.map((row) => row.id);

    if (allUserIds.length === 0) {
      console.log('⚠️  No active users found to add to community group.');
      return;
    }

    console.log(`\n📊 Found ${allUserIds.length} active users`);
    console.log('   Adding all users to community group...\n');

    // Add all users as participants in transaction
    await transaction(async (client) => {
      let addedCount = 0;
      let skippedCount = 0;

      for (const userId of allUserIds) {
        const result = await client.query(
          `INSERT INTO chat_participants (chat_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (chat_id, user_id) DO NOTHING
           RETURNING id`,
          [chatId, userId]
        );

        if (result.rows.length > 0) {
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      console.log(`✅ Participants added:`);
      console.log(`   New participants: ${addedCount}`);
      console.log(`   Already members: ${skippedCount}`);
      console.log(`   Total members: ${allUserIds.length}`);
    });

    // Invalidate cache for all users (outside transaction)
    try {
      const { chatCacheService } = await import('../services/chat-cache.service.js');
      chatCacheService.invalidateChatList(allUserIds);
      chatCacheService.invalidateChatDetail([chatId]);
    } catch (cacheError) {
      // Cache invalidation is not critical, just log it
      logger.warn('Failed to invalidate cache', { error: cacheError });
    }

    console.log('\n🎉 Community group seed completed successfully!');
    console.log(`\n📋 Community Details:`);
    console.log(`   Name: ${COMMUNITY_NAME}`);
    console.log(`   Avatar: ${COMMUNITY_AVATAR}`);
    console.log(`   Total Members: ${allUserIds.length}`);

  } catch (error) {
    console.error('❌ Community group seed failed:', error);
    logger.error('Community group seed failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Run if called directly
if (process.argv[1]?.includes('seed-community-group')) {
  seedCommunityGroup()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { seedCommunityGroup };

