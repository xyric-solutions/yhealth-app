/**
 * @file Reset Chats and Create Community Group
 * @description Deletes all chats, messages, and related data, then creates a single "balencia community" group chat with all users
 */

import { transaction, query, closePool } from './pg.js';
import { logger } from '../services/logger.service.js';
import { chatCacheService } from '../services/chat-cache.service.js';
import type { PoolClient } from 'pg';

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface ChatRow {
  id: string;
  chat_name: string;
  is_group_chat: boolean;
  is_community: boolean;
}

/**
 * Main migration function
 */
async function resetChatsAndCreateCommunity(): Promise<void> {
  logger.info('🚀 Starting chat reset and community group creation...');

  try {
    const result = await transaction(async (client: PoolClient) => {
      // Step 1: Delete all message_reads
      logger.info('📝 Deleting message_reads...');
      const messageReadsResult = await client.query('DELETE FROM message_reads');
      logger.info(`✅ Deleted ${messageReadsResult.rowCount} message_reads records`);

      // Step 2: Delete all message_reactions
      logger.info('📝 Deleting message_reactions...');
      const messageReactionsResult = await client.query('DELETE FROM message_reactions');
      logger.info(`✅ Deleted ${messageReactionsResult.rowCount} message_reactions records`);

      // Step 3: Delete all starred_messages
      logger.info('📝 Deleting starred_messages...');
      const starredMessagesResult = await client.query('DELETE FROM starred_messages');
      logger.info(`✅ Deleted ${starredMessagesResult.rowCount} starred_messages records`);

      // Step 4: Delete all messages
      logger.info('📝 Deleting messages...');
      const messagesResult = await client.query('DELETE FROM messages');
      logger.info(`✅ Deleted ${messagesResult.rowCount} messages records`);

      // Step 5: Delete all chat_participants
      logger.info('📝 Deleting chat_participants...');
      const chatParticipantsResult = await client.query('DELETE FROM chat_participants');
      logger.info(`✅ Deleted ${chatParticipantsResult.rowCount} chat_participants records`);

      // Step 6: Delete all chats
      logger.info('📝 Deleting chats...');
      const chatsResult = await client.query('DELETE FROM chats');
      logger.info(`✅ Deleted ${chatsResult.rowCount} chats records`);

      // Step 7: Get all users (including inactive)
      logger.info('👥 Fetching all users...');
      const usersResult = await client.query<UserRow>(
        'SELECT id, email, first_name, last_name FROM users ORDER BY created_at ASC'
      );
      const users = usersResult.rows;
      logger.info(`✅ Found ${users.length} users`);

      if (users.length === 0) {
        throw new Error('No users found in the database. Cannot create community group.');
      }

      // Step 8: Generate unique 6-digit join code
      logger.info('🔑 Generating join code...');
      let joinCode: string | undefined;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeCheck = await client.query(
          'SELECT COUNT(*) as count FROM chats WHERE join_code = $1',
          [code]
        );
        const count = parseInt(codeCheck.rows[0].count as string, 10);
        if (count === 0) {
          joinCode = code;
          break;
        }
        attempts++;
      }

      if (!joinCode) {
        throw new Error('Failed to generate unique join code');
      }

      const joinCodeExpiresAt = new Date();
      joinCodeExpiresAt.setHours(joinCodeExpiresAt.getHours() + 24 * 365); // 1 year expiration for community

      // Step 9: Create community group chat
      logger.info('🏘️ Creating community group chat...');
      const firstUser = users[0];
      const communityChatResult = await client.query<ChatRow>(
        `INSERT INTO chats (
          chat_name, 
          is_group_chat, 
          is_community, 
          avatar, 
          group_admin, 
          created_by, 
          join_code, 
          join_code_expires_at, 
          message_permission_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          'balencia community',
          true,
          true,
          null, // avatar
          firstUser.id, // group_admin
          firstUser.id, // created_by
          joinCode,
          joinCodeExpiresAt,
          'all', // message_permission_mode
        ]
      );

      const communityChat = communityChatResult.rows[0];
      logger.info(`✅ Created community group chat: ${communityChat.id} (${communityChat.chat_name})`);

      // Step 10: Add all users as participants
      logger.info(`👥 Adding ${users.length} users to community group...`);
      let addedCount = 0;
      let skippedCount = 0;

      for (const user of users) {
        try {
          await client.query(
            `INSERT INTO chat_participants (chat_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [communityChat.id, user.id]
          );
          addedCount++;
        } catch (error) {
          logger.warn(`⚠️ Failed to add user ${user.id} (${user.email}) to community group`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          skippedCount++;
        }
      }

      logger.info(`✅ Added ${addedCount} users to community group`);
      if (skippedCount > 0) {
        logger.warn(`⚠️ Skipped ${skippedCount} users due to errors`);
      }

      return {
        communityChatId: communityChat.id,
        communityChatName: communityChat.chat_name,
        usersAdded: addedCount,
        usersSkipped: skippedCount,
        totalUsers: users.length,
      };
    });

    // Step 11: Invalidate all chat caches
    logger.info('🗑️ Invalidating chat caches...');
    
    // Get all user IDs for cache invalidation
    const allUsersResult = await query<UserRow>('SELECT id FROM users');
    const allUserIds = allUsersResult.rows.map((u) => u.id);
    
    // Invalidate chat lists for all users
    chatCacheService.invalidateChatList(allUserIds);
    
    // Invalidate chat detail for the new community group
    chatCacheService.invalidateChatDetail([result.communityChatId]);
    
    // Invalidate chat participants cache
    chatCacheService.invalidateChatParticipants([result.communityChatId]);
    
    // Invalidate all message caches (pattern-based deletion)
    chatCacheService.invalidateMessages(result.communityChatId);
    
    logger.info('✅ Cache invalidation completed');

    // Success summary
    logger.info('🎉 Chat reset and community group creation completed successfully!');
    logger.info('📊 Summary:', {
      communityChatId: result.communityChatId,
      communityChatName: result.communityChatName,
      usersAdded: result.usersAdded,
      usersSkipped: result.usersSkipped,
      totalUsers: result.totalUsers,
    });

    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Community Group: "${result.communityChatName}" (ID: ${result.communityChatId})`);
    console.log(`👥 Users added: ${result.usersAdded} / ${result.totalUsers}`);
    if (result.usersSkipped > 0) {
      console.log(`⚠️ Users skipped: ${result.usersSkipped}`);
    }
  } catch (error) {
    logger.error('❌ Migration failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  } finally {
    await closePool();
  }
}

// Run the migration if this file is executed directly
if (import.meta.url.endsWith('reset-chats-and-create-community.ts') || 
    import.meta.url.endsWith('reset-chats-and-create-community.js') ||
    process.argv[1]?.includes('reset-chats-and-create-community')) {
  resetChatsAndCreateCommunity()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { resetChatsAndCreateCommunity };

