/**
 * Script para normalizar chatIds de conversas ativas
 * 
 * Corrige conversas criadas antes da normalização de telefones,
 * atualizando chatIds de whatsapp_XXXXXXXXXXX para whatsapp_55XXXXXXXXXXX
 * 
 * Uso: tsx scripts/fix-conversation-chatids.ts
 */

import { db } from '../server/db';
import { conversations } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { normalizePhone } from '../server/lib/phone-utils';

async function fixConversationChatIds() {
  console.log('🔍 Normalizando chatIds de conversas ativas...\n');

  const activeConvos = await db
    .select()
    .from(conversations)
    .where(sql`status IN ('active', 'pending')`)
    .orderBy(sql`created_at DESC`);

  console.log(`📊 Total de conversas ativas/pending: ${activeConvos.length}\n`);

  let fixed = 0;
  let skipped = 0;

  for (const convo of activeConvos) {
    const chatId = convo.chatId;
    
    // Extrair número do chatId (formato: whatsapp_NUMERO ou whatsapp_NUMERO@lid)
    const match = chatId.match(/^whatsapp_([0-9]+)(@lid)?$/);
    
    if (match) {
      const originalPhone = match[1];
      const suffix = match[2] || '';
      
      // Normalizar o número
      const normalized = normalizePhone(originalPhone);
      
      if (normalized && normalized !== originalPhone) {
        const newChatId = `whatsapp_${normalized}${suffix}`;
        
        console.log(`   ✏️  Atualizando conversa ${convo.id}`);
        console.log(`      Antigo: ${chatId}`);
        console.log(`      Novo: ${newChatId}`);
        console.log(`      Cliente: ${convo.clientName}`);
        
        // Atualizar chatId
        await db
          .update(conversations)
          .set({ chatId: newChatId })
          .where(sql`id = ${convo.id}`);
        
        fixed++;
      } else {
        skipped++;
      }
    } else {
      // chatId não é de WhatsApp ou já está em formato diferente
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Resultado da Normalização');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Conversas atualizadas: ${fixed}`);
  console.log(`⏭️  Conversas ignoradas (já normalizadas): ${skipped}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  // Verificar resultado
  const stillInvalid = await db
    .select()
    .from(conversations)
    .where(sql`status IN ('active', 'pending') AND chat_id LIKE 'whatsapp_%' AND chat_id NOT LIKE 'whatsapp_55%'`)
    .orderBy(sql`created_at DESC`);
  
  console.log('🔍 Verificação pós-normalização:');
  console.log(`   Conversas ativas com chatId sem 55: ${stillInvalid.length}`);
  
  if (stillInvalid.length > 0) {
    console.log('\n⚠️  Conversas que não foram normalizadas:');
    for (const conv of stillInvalid.slice(0, 5)) {
      console.log(`   - ${conv.chatId} (${conv.clientName})`);
    }
  } else {
    console.log('   ✅ Todas as conversas ativas agora têm chatId normalizado!');
  }
}

fixConversationChatIds()
  .then(() => {
    console.log('\n✅ Normalização completa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
