import { db } from '../server/db';
import { conversations } from '../shared/schema';
import { eq, and, like, notLike, or } from 'drizzle-orm';

async function fixMalformedLidChatIds() {
  console.log('🔍 Buscando conversas LID com chatId malformado...');

  // Find conversations with @lid suffix but missing lid_ prefix
  const malformedConversations = await db
    .select()
    .from(conversations)
    .where(
      or(
        // chatId has @lid but missing whatsapp_lid_ prefix
        and(
          like(conversations.chatId, '%@lid'),
          notLike(conversations.chatId, 'whatsapp_lid_%')
        ),
        // Old legacy format with @lid@s.whatsapp.net
        like(conversations.chatId, '%@lid@s.whatsapp.net')
      )
    );

  console.log(`📊 Encontradas ${malformedConversations.length} conversas com chatId malformado\n`);

  if (malformedConversations.length === 0) {
    console.log('✅ Nenhuma conversa malformada encontrada!');
    return;
  }

  let fixedCount = 0;
  let skippedCount = 0;

  for (const conv of malformedConversations) {
    const oldChatId = conv.chatId;
    
    // Extract the LID number from malformed chatId
    let lidNumber: string | null = null;
    
    if (oldChatId.includes('@lid@s.whatsapp.net')) {
      // Old format: 145685659840687@lid@s.whatsapp.net
      lidNumber = oldChatId.replace('@lid@s.whatsapp.net', '');
    } else if (oldChatId.startsWith('whatsapp_') && oldChatId.endsWith('@lid')) {
      // Current malformed: whatsapp_222805941596261@lid
      lidNumber = oldChatId.replace('whatsapp_', '').replace('@lid', '');
    } else if (!oldChatId.startsWith('whatsapp_') && oldChatId.endsWith('@lid')) {
      // Even older format: 222805941596261@lid
      lidNumber = oldChatId.replace('@lid', '');
    }

    if (!lidNumber) {
      console.log(`⚠️  SKIP: Não foi possível extrair LID number de "${oldChatId}"`);
      skippedCount++;
      continue;
    }

    // Build correct chatId format
    const newChatId = `whatsapp_lid_${lidNumber}`;

    console.log(`🔧 Corrigindo conversa ${conv.id}:`);
    console.log(`   Cliente: ${conv.clientName}`);
    console.log(`   ❌ OLD: ${oldChatId}`);
    console.log(`   ✅ NEW: ${newChatId}`);

    try {
      await db
        .update(conversations)
        .set({ chatId: newChatId })
        .where(eq(conversations.id, conv.id));

      console.log(`   ✅ Atualizado com sucesso!\n`);
      fixedCount++;
    } catch (error) {
      console.error(`   ❌ ERRO ao atualizar:`, error);
      skippedCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Correção concluída!`);
  console.log(`   - Conversas corrigidas: ${fixedCount}`);
  console.log(`   - Conversas puladas: ${skippedCount}`);
  console.log(`   - Total processadas: ${malformedConversations.length}`);
  console.log('='.repeat(60));
}

// Run the fix
fixMalformedLidChatIds()
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });
