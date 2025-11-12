/**
 * Script para limpar conversas problemáticas das campanhas de cobrança
 * 
 * Remove conversas que:
 * - Não têm mensagens
 * - Têm apenas mensagens vazias
 * - Foram criadas antes da correção de normalização de telefones
 * 
 * Uso: tsx scripts/clean-problematic-conversations.ts
 */

import { db } from '../server/db';
import { conversations, messages, voiceCampaignTargets } from '../shared/schema';
import { eq, and, or, sql, inArray } from 'drizzle-orm';

async function cleanProblematicConversations() {
  console.log('🧹 Iniciando limpeza de conversas problemáticas...\n');

  try {
    // Buscar todas as conversas da instância Cobranca
    const cobrancaConvs = await db.select()
      .from(conversations)
      .where(eq(conversations.evolutionInstance, 'Cobranca'));
    
    console.log(`📊 Total de conversas Cobrança: ${cobrancaConvs.length}\n`);

    if (cobrancaConvs.length === 0) {
      console.log('✅ Nenhuma conversa de cobrança encontrada');
      return { deleted: 0, kept: 0 };
    }

    let deleted = 0;
    let kept = 0;
    const conversationsToDelete: string[] = [];

    // Processar em lotes para eficiência
    const batchSize = 50;
    for (let i = 0; i < cobrancaConvs.length; i += batchSize) {
      const batch = cobrancaConvs.slice(i, i + batchSize);
      const convIds = batch.map(c => c.id);

      // Buscar todas as mensagens do lote de uma vez
      const allMessages = await db.select()
        .from(messages)
        .where(inArray(messages.conversationId, convIds));

      // Agrupar mensagens por conversationId
      const messagesByConv = new Map<string, typeof allMessages>();
      for (const msg of allMessages) {
        if (!messagesByConv.has(msg.conversationId)) {
          messagesByConv.set(msg.conversationId, []);
        }
        messagesByConv.get(msg.conversationId)!.push(msg);
      }

      // Analisar cada conversa
      for (const conv of batch) {
        const convMessages = messagesByConv.get(conv.id) || [];
        
        // Critérios para deletar
        const hasNoMessages = convMessages.length === 0;
        const hasOnlySystemMessages = convMessages.length > 0 && convMessages.every(m => m.role === 'system');
        const allMessagesEmpty = convMessages.length > 0 && convMessages.every(m => !m.content || m.content.trim() === '');
        
        const shouldDelete = hasNoMessages || hasOnlySystemMessages || allMessagesEmpty;

        if (shouldDelete) {
          conversationsToDelete.push(conv.id);
          console.log(`🗑️  Marcando para deletar: ${conv.id} (${conv.clientName || 'Sem nome'})`);
          console.log(`   Razão: ${hasNoMessages ? 'Sem mensagens' : hasOnlySystemMessages ? 'Apenas sistema' : 'Mensagens vazias'}`);
        } else {
          kept++;
        }
      }

      console.log(`   Processado lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(cobrancaConvs.length / batchSize)}`);
    }

    console.log(`\n📋 Resumo da Análise:`);
    console.log(`   Total analisadas: ${cobrancaConvs.length}`);
    console.log(`   Para deletar: ${conversationsToDelete.length}`);
    console.log(`   Para manter: ${kept}`);

    if (conversationsToDelete.length === 0) {
      console.log('\n✅ Nenhuma conversa problemática encontrada!');
      return { deleted: 0, kept };
    }

    console.log('\n🗑️  Deletando conversas problemáticas...');

    // Deletar mensagens primeiro
    console.log('   Deletando mensagens...');
    const deletedMessages = await db.delete(messages)
      .where(inArray(messages.conversationId, conversationsToDelete));

    // Limpar conversationId dos targets
    console.log('   Limpando referências em targets...');
    await db.update(voiceCampaignTargets)
      .set({ conversationId: null })
      .where(inArray(voiceCampaignTargets.conversationId, conversationsToDelete));

    // Deletar conversas
    console.log('   Deletando conversas...');
    await db.delete(conversations)
      .where(inArray(conversations.id, conversationsToDelete));

    deleted = conversationsToDelete.length;

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Resultado da Limpeza');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🗑️  Conversas deletadas: ${deleted}`);
    console.log(`✅ Conversas mantidas: ${kept}`);
    console.log(`📊 Total processadas: ${cobrancaConvs.length}`);
    console.log('═══════════════════════════════════════════════════\n');

    return { deleted, kept };

  } catch (error) {
    console.error('\n❌ Erro durante limpeza:', error);
    throw error;
  }
}

cleanProblematicConversations()
  .then(({ deleted, kept }) => {
    console.log('✅ Limpeza concluída com sucesso!');
    console.log(`   ${deleted} conversas removidas, ${kept} mantidas\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
