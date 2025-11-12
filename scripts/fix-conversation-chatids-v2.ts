/**
 * Script para normalizar chatIds de conversas ativas (v2)
 * 
 * Estratégia:
 * - Se já existe conversa com chatId normalizado: marca a antiga como 'resolved'
 * - Se não existe: atualiza o chatId
 * 
 * Uso: tsx scripts/fix-conversation-chatids-v2.ts
 */

import { db } from '../server/db';
import { conversations } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { normalizePhone } from '../server/lib/phone-utils';

async function fixConversationChatIdsV2() {
  console.log('🔍 Normalizando chatIds de conversas ativas (v2)...\n');

  const activeConvos = await db
    .select()
    .from(conversations)
    .where(sql`status IN ('active', 'pending')`)
    .orderBy(sql`created_at DESC`);

  console.log(`📊 Total de conversas ativas/pending: ${activeConvos.length}\n`);

  let updated = 0;
  let resolved = 0;
  let skipped = 0;

  for (const convo of activeConvos) {
    const chatId = convo.chatId;
    
    // Extrair número do chatId
    const match = chatId.match(/^whatsapp_([0-9]+)(@lid)?$/);
    
    if (match) {
      const originalPhone = match[1];
      const suffix = match[2] || '';
      
      // Normalizar o número
      const normalized = normalizePhone(originalPhone);
      
      if (normalized && normalized !== originalPhone) {
        const newChatId = `whatsapp_${normalized}${suffix}`;
        
        // Verificar se já existe conversa com chatId normalizado (em qualquer status)
        const existing = await db
          .select()
          .from(conversations)
          .where(sql`chat_id = ${newChatId}`)
          .limit(1);
        
        if (existing.length > 0) {
          // Já existe conversa com chatId normalizado - marcar antiga como resolved
          console.log(`   🔄 Conversa duplicada detectada:`);
          console.log(`      Antiga: ${chatId} (ID: ${convo.id}) - Status: ${convo.status}`);
          console.log(`      Nova: ${newChatId} (ID: ${existing[0].id}) - Status: ${existing[0].status}`);
          console.log(`      Ação: Marcando antiga como 'resolved'`);
          console.log(`      Cliente: ${convo.clientName}`);
          
          await db
            .update(conversations)
            .set({ 
              status: 'resolved',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              resolutionNote: 'Conversa duplicada - chatId normalizado existe'
            })
            .where(sql`id = ${convo.id}`);
          
          resolved++;
        } else {
          // Não existe - pode atualizar chatId
          console.log(`   ✏️  Atualizando conversa ${convo.id}`);
          console.log(`      Antigo: ${chatId}`);
          console.log(`      Novo: ${newChatId}`);
          console.log(`      Cliente: ${convo.clientName}`);
          
          await db
            .update(conversations)
            .set({ chatId: newChatId })
            .where(sql`id = ${convo.id}`);
          
          updated++;
        }
        
        console.log('');
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  Resultado da Normalização (v2)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ ChatIds atualizados: ${updated}`);
  console.log(`🔄 Conversas antigas resolvidas: ${resolved}`);
  console.log(`⏭️  Conversas ignoradas (já normalizadas): ${skipped}`);
  console.log('═══════════════════════════════════════════════════\n');
  
  // Verificar resultado
  const stillInvalid = await db
    .select()
    .from(conversations)
    .where(sql`status IN ('active', 'pending') AND chat_id LIKE 'whatsapp_%' AND chat_id NOT LIKE 'whatsapp_55%' AND chat_id NOT LIKE '%@%'`)
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

fixConversationChatIdsV2()
  .then(() => {
    console.log('\n✅ Normalização completa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
