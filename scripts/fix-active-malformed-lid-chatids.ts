import { db } from '../server/db';
import { conversations } from '../shared/schema';
import { eq, and, like, notLike, or, ne } from 'drizzle-orm';

async function fixActiveMalformedLidChatIds() {
  console.log('🔍 Buscando conversas ATIVAS com chatId LID malformado...\n');

  // Find ACTIVE conversations with @lid suffix but missing lid_ prefix
  const malformedConversations = await db
    .select()
    .from(conversations)
    .where(
      and(
        // Must be ACTIVE or TRANSFERRED (not resolved)
        or(
          eq(conversations.status, 'active'),
          eq(conversations.status, 'transferred')
        ),
        // chatId has @lid but missing whatsapp_lid_ prefix
        or(
          and(
            like(conversations.chatId, '%@lid'),
            notLike(conversations.chatId, 'whatsapp_lid_%')
          ),
          // Old legacy format with @lid@s.whatsapp.net
          like(conversations.chatId, '%@lid@s.whatsapp.net')
        )
      )
    );

  console.log(`📊 Encontradas ${malformedConversations.length} conversas ATIVAS com chatId malformado\n`);

  if (malformedConversations.length === 0) {
    console.log('✅ Nenhuma conversa ATIVA malformada encontrada!');
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
    console.log(`   Status: ${conv.status}`);
    console.log(`   ❌ OLD: ${oldChatId}`);
    console.log(`   ✅ NEW: ${newChatId}`);

    try {
      // Check if newChatId already exists for a DIFFERENT conversation
      const existing = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.chatId, newChatId),
            ne(conversations.id, conv.id) // Different conversation ID
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const existingConv = existing[0];
        console.log(`   ⚠️  CONFLITO: chatId "${newChatId}" já existe em outra conversa:`);
        console.log(`      ID: ${existingConv.id}`);
        console.log(`      Cliente: ${existingConv.clientName}`);
        console.log(`      Status: ${existingConv.status}`);
        console.log(`      Última msg: ${existingConv.lastMessageTime}`);
        
        // If existing conversation is RESOLVED and old, we can safely update current one
        if (existingConv.status === 'resolved') {
          console.log(`   ✅ Conversa existente está RESOLVIDA - prosseguindo com atualização...`);
          
          // First, update the old resolved conversation to a unique chatId to free up the slot
          const tempChatId = `${oldChatId}_OLD_${Date.now()}`;
          await db
            .update(conversations)
            .set({ chatId: tempChatId })
            .where(eq(conversations.id, existingConv.id));
          
          console.log(`   📝 Conversa antiga renomeada para: ${tempChatId}`);
          
          // Now update current conversation to correct chatId
          await db
            .update(conversations)
            .set({ chatId: newChatId })
            .where(eq(conversations.id, conv.id));

          console.log(`   ✅ Atualizado com sucesso!\n`);
          fixedCount++;
        } else {
          console.log(`   ❌ SKIP: Conversa existente está ATIVA - não é seguro atualizar\n`);
          skippedCount++;
        }
      } else {
        // No conflict, safe to update
        await db
          .update(conversations)
          .set({ chatId: newChatId })
          .where(eq(conversations.id, conv.id));

        console.log(`   ✅ Atualizado com sucesso!\n`);
        fixedCount++;
      }
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
fixActiveMalformedLidChatIds()
  .then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
  });
