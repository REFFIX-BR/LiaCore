import { db } from '../server/db';
import { conversations } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { buildWhatsAppChatId, normalizePhone } from '../server/lib/phone-utils';

console.log('🔧 Fixing conversations with triple "55" in chatId...\n');

async function main() {
  // 1. Find conversations with chatId containing "whatsapp_555"
  console.log('📊 Step 1: Finding conversations with triple "55"...');
  
  const affectedConversations = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.chatId} LIKE 'whatsapp_555%'`);
  
  console.log(`   Found ${affectedConversations.length} conversations with triple "55"\n`);
  
  if (affectedConversations.length === 0) {
    console.log('✅ No conversations with triple "55" found! Database is clean.');
    return;
  }
  
  // 2. Fix each conversation
  console.log('🔄 Step 2: Fixing chatIds...');
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const conv of affectedConversations) {
    try {
      // Extract phone from chatId by removing "whatsapp_" prefix
      const oldChatId = conv.chatId;
      const phoneFromChatId = oldChatId.replace('whatsapp_', '');
      
      // CRITICAL: Use normalizePhone() to properly fix all "55" duplications
      // This handles "555524..." (15 digits) -> "5524..." (13 digits)
      // and "55555..." (17 digits) -> "5524..." (13 digits)
      const normalizedPhone = normalizePhone(phoneFromChatId);
      
      if (!normalizedPhone) {
        console.warn(`   ⚠️ SKIP: Invalid phone in chatId: ${oldChatId}`);
        skipped++;
        continue;
      }
      
      const newChatId = buildWhatsAppChatId(normalizedPhone);
      
      if (oldChatId === newChatId) {
        console.log(`   ✓ OK: ${oldChatId} (already correct)`);
        skipped++;
        continue;
      }
      
      // Check if the corrected chatId already exists
      const existing = await db
        .select()
        .from(conversations)
        .where(sql`${conversations.chatId} = ${newChatId}`)
        .limit(1);
      
      if (existing.length > 0) {
        console.warn(`   ⚠️ CONFLICT: ${newChatId} already exists, skipping ${oldChatId}`);
        skipped++;
        continue;
      }
      
      // Update the conversation
      await db
        .update(conversations)
        .set({ chatId: newChatId })
        .where(sql`${conversations.id} = ${conv.id}`);
      
      console.log(`   ✅ FIXED: "${oldChatId}" -> "${newChatId}" (${conv.clientName})`);
      fixed++;
      
    } catch (error) {
      console.error(`   ❌ ERROR: Failed to fix ${conv.chatId}:`, error);
      errors++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Fixed: ${fixed} conversations`);
  console.log(`   ⏭️  Skipped: ${skipped} conversations`);
  console.log(`   ❌ Errors: ${errors} conversations`);
  console.log(`   📦 Total: ${affectedConversations.length} conversations\n`);
  
  // 3. Validation
  console.log('🔍 Step 3: Validating results...');
  const remaining = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.chatId} LIKE 'whatsapp_555%'`);
  
  if (remaining.length === 0) {
    console.log('   ✅ All chatIds are now correct!\n');
  } else {
    console.warn(`   ⚠️ Still found ${remaining.length} conversations with triple "55":\n`);
    for (const conv of remaining.slice(0, 5)) {
      console.warn(`      - ${conv.chatId} (${conv.clientName})`);
    }
    if (remaining.length > 5) {
      console.warn(`      ... and ${remaining.length - 5} more`);
    }
  }
  
  console.log('✅ Backfill complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
