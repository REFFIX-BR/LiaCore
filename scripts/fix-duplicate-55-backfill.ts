import { db } from '../server/db';
import { voiceCampaignTargets, conversations } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { normalizePhone } from '../server/lib/phone-utils';

console.log('🔧 Starting backfill to fix duplicate "55" prefixes...\n');

async function main() {
  // 1. Find all targets with malformed phone numbers (> 13 digits or starting with "555")
  console.log('📊 Step 1: Finding malformed phone numbers...');
  
  const malformedTargets = await db
    .select()
    .from(voiceCampaignTargets)
    .where(sql`LENGTH(${voiceCampaignTargets.phoneNumber}) > 13 OR ${voiceCampaignTargets.phoneNumber} LIKE '555%'`);
  
  console.log(`   Found ${malformedTargets.length} targets with potential issues\n`);
  
  if (malformedTargets.length === 0) {
    console.log('✅ No malformed numbers found! Database is clean.');
    return;
  }
  
  // 2. Re-normalize and update each target
  console.log('🔄 Step 2: Re-normalizing phone numbers...');
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const target of malformedTargets) {
    try {
      const normalized = normalizePhone(target.phoneNumber);
      
      if (!normalized) {
        console.warn(`   ⚠️ SKIP: Invalid phone "${target.phoneNumber}" for ${target.debtorName}`);
        skipped++;
        continue;
      }
      
      if (normalized === target.phoneNumber) {
        console.log(`   ✓ OK: ${target.phoneNumber} (${target.debtorName}) - already normalized`);
        skipped++;
        continue;
      }
      
      // Update the target
      await db
        .update(voiceCampaignTargets)
        .set({ phoneNumber: normalized })
        .where(eq(voiceCampaignTargets.id, target.id));
      
      console.log(`   ✅ FIXED: "${target.phoneNumber}" -> "${normalized}" (${target.debtorName})`);
      updated++;
      
      // 3. Update related conversations' chat_id if they exist
      const relatedConvs = await db
        .select()
        .from(conversations)
        .where(eq(conversations.voiceCampaignTargetId, target.id));
      
      for (const conv of relatedConvs) {
        const oldChatId = conv.chatId;
        const newChatId = `whatsapp_${normalized}`;
        
        if (oldChatId !== newChatId) {
          await db
            .update(conversations)
            .set({ chatId: newChatId })
            .where(eq(conversations.id, conv.id));
          
          console.log(`      📞 Updated conversation chat_id: "${oldChatId}" -> "${newChatId}"`);
        }
      }
      
    } catch (error) {
      console.error(`   ❌ ERROR: Failed to update ${target.phoneNumber} (${target.debtorName}):`, error);
      errors++;
    }
  }
  
  console.log('\n📊 Backfill Summary:');
  console.log(`   ✅ Updated: ${updated} targets`);
  console.log(`   ⏭️  Skipped: ${skipped} targets`);
  console.log(`   ❌ Errors: ${errors} targets`);
  console.log(`   📦 Total processed: ${malformedTargets.length} targets\n`);
  
  // 4. Validation: Check for remaining malformed numbers
  console.log('🔍 Step 3: Validating results...');
  const remainingIssues = await db
    .select()
    .from(voiceCampaignTargets)
    .where(sql`LENGTH(${voiceCampaignTargets.phoneNumber}) > 13`);
  
  if (remainingIssues.length === 0) {
    console.log('   ✅ All phone numbers are now normalized (12-13 digits)!\n');
  } else {
    console.warn(`   ⚠️ Still found ${remainingIssues.length} numbers with > 13 digits:\n`);
    for (const issue of remainingIssues.slice(0, 5)) {
      console.warn(`      - ${issue.phoneNumber} (${issue.debtorName})`);
    }
    if (remainingIssues.length > 5) {
      console.warn(`      ... and ${remainingIssues.length - 5} more`);
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
