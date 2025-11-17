#!/usr/bin/env tsx
/**
 * Migration Script: Fix WhatsApp Business (LID) clientId format
 * 
 * Problem: Existing conversations have clientId in Evolution API format "XXX@lid"
 * Solution: Migrate to internal format "lid_XXX" for consistency
 * 
 * Example:
 * Before: clientId = "253222832857292@lid"
 * After:  clientId = "lid_253222832857292"
 */

import { db } from '../server/db';
import { conversations } from '../shared/schema';
import { eq, like, sql } from 'drizzle-orm';

async function migrateClientIds() {
  console.log('🔍 [Migration] Starting LID clientId migration...\n');

  // Find all conversations with LID chatIds but clientId still in @lid format
  const affectedConversations = await db
    .select({
      id: conversations.id,
      chatId: conversations.chatId,
      clientId: conversations.clientId,
      clientName: conversations.clientName,
    })
    .from(conversations)
    .where(
      sql`${conversations.chatId} LIKE 'whatsapp_lid_%' 
          AND ${conversations.clientId} LIKE '%@lid'
          AND ${conversations.clientId} NOT LIKE 'lid_%'`
    );

  console.log(`📊 [Migration] Found ${affectedConversations.length} conversations to migrate\n`);

  if (affectedConversations.length === 0) {
    console.log('✅ [Migration] No conversations need migration. All clientIds are already correct!');
    return;
  }

  // Show sample
  console.log('📝 [Migration] Sample of conversations to migrate:');
  affectedConversations.slice(0, 5).forEach((conv) => {
    console.log(`   ${conv.clientName || 'Unknown'} (${conv.chatId})`);
    console.log(`      clientId: "${conv.clientId}" → "lid_${conv.clientId.replace('@lid', '')}"`);
  });
  console.log();

  // Migrate each conversation
  let successCount = 0;
  let errorCount = 0;

  for (const conv of affectedConversations) {
    try {
      // Extract LID number from "@lid" format
      const lidNumber = conv.clientId.replace('@lid', '');
      const newClientId = `lid_${lidNumber}`;

      await db
        .update(conversations)
        .set({ clientId: newClientId })
        .where(eq(conversations.id, conv.id));

      successCount++;
      console.log(`✅ Migrated: ${conv.clientName} - ${conv.clientId} → ${newClientId}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error migrating conversation ${conv.id}:`, error);
    }
  }

  console.log('\n📊 [Migration] Summary:');
  console.log(`   ✅ Successfully migrated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total processed: ${affectedConversations.length}`);

  if (successCount === affectedConversations.length) {
    console.log('\n🎉 [Migration] All clientIds migrated successfully!');
  }
}

// Run migration
migrateClientIds()
  .then(() => {
    console.log('\n✅ [Migration] Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [Migration] Script failed:', error);
    process.exit(1);
  });
