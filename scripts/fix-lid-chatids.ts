/**
 * Migration Script: Fix WhatsApp Business (@lid) Chat IDs
 * 
 * Problem: Evolution API sends Business accounts with remoteJid ending in @lid
 * Previous webhook code didn't handle this, creating malformed chat_ids like:
 * - "whatsapp_145853079679217@lid" (WRONG)
 * 
 * Solution: Migrate to proper format:
 * - "whatsapp_lid_145853079679217" (CORRECT)
 * 
 * This script:
 * 1. Identifies conversations with @lid in chat_id
 * 2. Updates chat_id to whatsapp_lid_<id> format
 * 3. Preserves all conversation history and metadata
 * 4. Updates Redis thread mapping if needed
 */

import { db } from "../server/db";
import { conversations } from "../shared/schema";
import { eq, like } from "drizzle-orm";
import { RedisCache } from "../server/lib/redis-config";

async function main() {
  console.log('🔧 [Migration] Starting @lid chat_id migration...');
  
  try {
    // Find all conversations with @lid in chat_id
    const affectedConversations = await db
      .select()
      .from(conversations)
      .where(like(conversations.chatId, '%@lid'))
      .execute();
    
    if (affectedConversations.length === 0) {
      console.log('✅ [Migration] No conversations found with @lid in chat_id');
      return;
    }
    
    console.log(`📋 [Migration] Found ${affectedConversations.length} conversation(s) to migrate:`);
    
    for (const conv of affectedConversations) {
      const oldChatId = conv.chatId;
      
      // Extract LID from old chat_id
      // Example: "whatsapp_145853079679217@lid" -> "145853079679217"
      const lidMatch = oldChatId.match(/whatsapp_(.+)@lid/);
      
      if (!lidMatch) {
        console.warn(`⚠️ [Migration] Could not parse LID from chat_id: ${oldChatId} - skipping`);
        continue;
      }
      
      const lid = lidMatch[1];
      const newChatId = `whatsapp_lid_${lid}`;
      
      console.log(`\n📝 [Migration] Processing conversation ${conv.id}:`);
      console.log(`   Client: ${conv.clientName}`);
      console.log(`   Old chat_id: ${oldChatId}`);
      console.log(`   New chat_id: ${newChatId}`);
      
      // Update conversation chat_id in database
      await db
        .update(conversations)
        .set({ 
          chatId: newChatId,
          // Also update metadata if it contains the old remoteJid
          metadata: conv.metadata ? {
            ...conv.metadata as Record<string, any>,
            remoteJid: `${lid}@lid`, // Fix remoteJid in metadata
          } : null,
        })
        .where(eq(conversations.id, conv.id))
        .execute();
      
      console.log(`   ✅ Database updated`);
      
      // Update Redis thread mapping if thread exists
      if (conv.threadId) {
        try {
          const redis = RedisCache.getInstance();
          
          // Check if old key exists
          const oldThreadKey = `thread:${oldChatId}`;
          const threadExists = await redis.get(oldThreadKey);
          
          if (threadExists) {
            // Move thread to new key
            const newThreadKey = `thread:${newChatId}`;
            await redis.set(newThreadKey, conv.threadId);
            await redis.delete(oldThreadKey);
            console.log(`   ✅ Redis thread mapping updated: ${oldThreadKey} -> ${newThreadKey}`);
          } else {
            console.log(`   ℹ️  No Redis thread mapping found (thread may be in DB only)`);
          }
        } catch (redisError) {
          console.warn(`   ⚠️ Redis update failed (non-fatal):`, redisError);
        }
      }
      
      console.log(`   ✅ Migration complete for ${conv.clientName}`);
    }
    
    console.log(`\n✅ [Migration] Successfully migrated ${affectedConversations.length} conversation(s)`);
    console.log('\n📋 [Migration] Summary:');
    for (const conv of affectedConversations) {
      const lid = conv.chatId.match(/whatsapp_(.+)@lid/)?.[1];
      console.log(`   • ${conv.clientName}: whatsapp_lid_${lid}`);
    }
    
  } catch (error) {
    console.error('❌ [Migration] Error during migration:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ [Migration] Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [Migration] Migration failed:', error);
    process.exit(1);
  });
