/**
 * Script para deletar conversas ativas sem mensagens
 * 
 * Remove conversas que não têm nenhuma mensagem associada
 * 
 * Uso: tsx scripts/delete-empty-conversations.ts
 */

import { db } from '../server/db';
import { conversations, messages } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

async function deleteEmptyConversations() {
  console.log('🗑️  Deletando conversas sem mensagens...\n');

  // Buscar todas conversas ativas
  const activeConvos = await db
    .select()
    .from(conversations)
    .where(sql`status = 'active'`);

  console.log(`📊 Total de conversas ativas: ${activeConvos.length}\n`);

  // Verificar quais não têm mensagens
  const toDelete = [];
  
  for (const conv of activeConvos) {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .limit(1);
    
    if (msgs.length === 0) {
      toDelete.push(conv);
    }
  }

  console.log(`🗑️  Conversas a deletar: ${toDelete.length}\n`);

  if (toDelete.length > 0) {
    console.log('📋 Deletando conversas:\n');
    
    for (const conv of toDelete) {
      console.log(`   ❌ ${conv.clientName} (${conv.chatId})`);
      
      // Deletar conversa
      await db
        .delete(conversations)
        .where(eq(conversations.id, conv.id));
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Resultado');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🗑️  Conversas deletadas: ${toDelete.length}`);
  console.log('═══════════════════════════════════════════════════');
  
  // Verificar resultado
  const remaining = await db
    .select()
    .from(conversations)
    .where(sql`status = 'active'`);
  
  console.log(`\n✅ Conversas ativas restantes: ${remaining.length}`);
}

deleteEmptyConversations()
  .then(() => {
    console.log('\n✅ Limpeza completa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
