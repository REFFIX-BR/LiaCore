import { db } from '../server/db';
import { conversations, messages } from '../shared/schema';
import { eq, like, sql } from 'drizzle-orm';

console.log('🗑️  Deletando conversas duplicadas com triple "55"...\n');

async function main() {
  // Find all conversations with triple-55 chatIds (> 13 digit phone numbers)
  const triple55Conversations = await db
    .select({
      id: conversations.id,
      chatId: conversations.chatId,
      clientName: conversations.clientName,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(
      sql`${conversations.chatId} LIKE 'whatsapp_555%' 
          AND LENGTH(SUBSTRING(${conversations.chatId} FROM 'whatsapp_(.*)')) > 13`
    )
    .orderBy(conversations.createdAt);

  console.log(`📊 Encontradas ${triple55Conversations.length} conversas com triple "55"\n`);

  if (triple55Conversations.length === 0) {
    console.log('✅ Nenhuma conversa duplicada encontrada!');
    return;
  }

  let deletedCount = 0;
  let skippedCount = 0;

  for (const conv of triple55Conversations) {
    const correctChatId = conv.chatId.replace(/whatsapp_5555/, 'whatsapp_55');
    
    // Check if correct conversation exists
    const correctConv = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.chatId, correctChatId))
      .limit(1);

    if (correctConv.length > 0) {
      console.log(`🗑️  Deletando duplicata: ${conv.chatId}`);
      console.log(`   Cliente: ${conv.clientName}`);
      console.log(`   Conversa correta existe: ${correctChatId}`);
      
      // Delete messages first
      await db.delete(messages).where(eq(messages.conversationId, conv.id));
      
      // Delete conversation
      await db.delete(conversations).where(eq(conversations.id, conv.id));
      
      deletedCount++;
      console.log(`   ✅ Deletada com sucesso!\n`);
    } else {
      console.log(`⏭️  Mantendo: ${conv.chatId} (não há conversa correta correspondente)`);
      skippedCount++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Deletadas: ${deletedCount}`);
  console.log(`   ⏭️  Mantidas: ${skippedCount}`);
  console.log(`   📦 Total: ${triple55Conversations.length}`);
  
  // Verify no more duplicates exist
  const remaining = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(
      sql`${conversations.chatId} LIKE 'whatsapp_555%' 
          AND LENGTH(SUBSTRING(${conversations.chatId} FROM 'whatsapp_(.*)')) > 13`
    );

  console.log(`\n🔍 Verificação final: ${remaining[0].count} conversas com triple "55" restantes`);
}

main()
  .then(() => {
    console.log('\n✅ Limpeza concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });
