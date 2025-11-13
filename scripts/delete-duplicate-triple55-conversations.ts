import { db } from '../server/db';
import { conversations } from '@shared/schema';
import { sql } from 'drizzle-orm';

console.log('🗑️  Deleting duplicate conversations with triple "55" in chatId...\n');

async function main() {
  // Find all conversations with chatId starting with "whatsapp_555"
  console.log('📊 Step 1: Finding duplicate conversations...');
  
  const duplicates = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.chatId} LIKE 'whatsapp_555%'`);
  
  console.log(`   Found ${duplicates.length} conversations with triple "55"\n`);
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicate conversations found!');
    return;
  }
  
  // Delete each duplicate conversation
  console.log('🔄 Step 2: Deleting duplicate conversations...');
  let deleted = 0;
  let skipped = 0;
  
  for (const conv of duplicates) {
    try {
      // Extract the corrected chatId (remove one "55")
      const phoneWithTriple55 = conv.chatId.replace('whatsapp_', '');
      
      // Check if this looks like a triple-55 case (starts with "5555")
      if (!phoneWithTriple55.startsWith('5555')) {
        console.warn(`   ⏭️  SKIP: Not a triple-55 case: ${conv.chatId}`);
        skipped++;
        continue;
      }
      
      const correctedChatId = `whatsapp_${phoneWithTriple55.substring(2)}`;
      
      // Check if the corrected version exists
      const correctExists = await db
        .select()
        .from(conversations)
        .where(sql`${conversations.chatId} = ${correctedChatId}`)
        .limit(1);
      
      if (correctExists.length === 0) {
        console.warn(`   ⚠️  SKIP: Corrected version doesn't exist: ${conv.chatId} -> ${correctedChatId}`);
        skipped++;
        continue;
      }
      
      // Delete the duplicate
      await db
        .delete(conversations)
        .where(sql`${conversations.id} = ${conv.id}`);
      
      console.log(`   ✅ DELETED: ${conv.chatId} (${conv.clientName}) - corrected version exists: ${correctedChatId}`);
      deleted++;
      
    } catch (error) {
      console.error(`   ❌ ERROR: Failed to delete ${conv.chatId}:`, error);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Deleted: ${deleted} conversations`);
  console.log(`   ⏭️  Skipped: ${skipped} conversations`);
  console.log(`   📦 Total: ${duplicates.length} conversations\n`);
  
  // Validation
  console.log('🔍 Step 3: Validating results...');
  const remaining = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.chatId} LIKE 'whatsapp_555%'`);
  
  if (remaining.length === 0) {
    console.log('   ✅ All duplicate conversations deleted!\n');
  } else {
    console.warn(`   ⚠️ Still found ${remaining.length} conversations with triple "55":\n`);
    for (const conv of remaining.slice(0, 5)) {
      console.warn(`      - ${conv.chatId} (${conv.clientName})`);
    }
    if (remaining.length > 5) {
      console.warn(`      ... and ${remaining.length - 5} more`);
    }
  }
  
  console.log('✅ Cleanup complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
