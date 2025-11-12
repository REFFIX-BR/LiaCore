/**
 * Script para LIMPAR COMPLETAMENTE todas as filas
 * 
 * Remove TODOS os jobs de todas as filas de voz
 * 
 * Uso: tsx scripts/clean-all-queues.ts
 */

import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function cleanAllQueues() {
  console.log('🧹 LIMPANDO TODAS AS FILAS COMPLETAMENTE...\n');

  const queueNames = [
    'voice-whatsapp-collection',
    'voice-scheduling',
    'voice-dialer',
    'voice-post-call',
    'voice-promise-monitor',
    'message-processing', // Fila de mensagens principais também
  ];

  let totalRemoved = 0;

  for (const queueName of queueNames) {
    try {
      console.log(`📋 Limpando fila: ${queueName}`);
      const queue = new Queue(queueName, { connection: redisConnection });
      
      // Obter contagem antes
      const waiting = await queue.getWaiting();
      const delayed = await queue.getDelayed();
      const active = await queue.getActive();
      const failed = await queue.getFailed();
      const completed = await queue.getCompleted();
      
      const total = waiting.length + delayed.length + active.length + failed.length + completed.length;
      
      console.log(`   Jobs encontrados:`);
      console.log(`   - Waiting: ${waiting.length}`);
      console.log(`   - Delayed: ${delayed.length}`);
      console.log(`   - Active: ${active.length}`);
      console.log(`   - Failed: ${failed.length}`);
      console.log(`   - Completed: ${completed.length}`);
      console.log(`   TOTAL: ${total}`);
      
      if (total > 0) {
        // Pausar fila primeiro
        await queue.pause();
        
        // Obliterar tudo (remove TODOS os jobs)
        await queue.obliterate({ force: true });
        
        console.log(`   ✅ ${total} jobs removidos!`);
        totalRemoved += total;
      } else {
        console.log(`   ⏭️  Fila já estava vazia`);
      }
      
      console.log('');
      
      await queue.close();
    } catch (error: any) {
      console.error(`❌ Erro ao limpar fila ${queueName}:`, error.message);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  Resultado da Limpeza');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🗑️  Total de jobs removidos: ${totalRemoved}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('\n✅ TODAS AS FILAS FORAM COMPLETAMENTE LIMPAS!');
  console.log('\n⚠️  Para reativar envios: tsx scripts/unpause-queues.ts');
}

cleanAllQueues()
  .then(() => {
    console.log('\n✅ Limpeza completa concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
