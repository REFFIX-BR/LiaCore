/**
 * Script para REATIVAR as filas de voz
 * 
 * Despausar todas as filas após validação completa
 * 
 * Uso: tsx scripts/unpause-queues.ts
 */

import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function unpauseQueues() {
  console.log('🔄 Reativando filas de voz...\n');

  const queueNames = [
    'voice-whatsapp-collection',
    'voice-scheduling',
    'voice-dialer',
    'voice-post-call',
    'voice-promise-monitor',
  ];

  for (const queueName of queueNames) {
    try {
      const queue = new Queue(queueName, { connection: redisConnection });
      
      // Despausar fila
      await queue.resume();
      console.log(`✅ Fila reativada: ${queueName}`);
      
      // Mostrar estatísticas
      const waiting = await queue.getWaiting();
      const delayed = await queue.getDelayed();
      
      console.log(`   - Waiting: ${waiting.length}`);
      console.log(`   - Delayed: ${delayed.length}`);
      console.log('');
      
      await queue.close();
    } catch (error: any) {
      console.error(`❌ Erro ao reativar fila ${queueName}:`, error.message);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ TODAS AS FILAS FORAM REATIVADAS');
  console.log('═══════════════════════════════════════════════════');
  console.log('\n⚠️  Os envios de voz/WhatsApp foram retomados!');
}

unpauseQueues()
  .then(() => {
    console.log('\n✅ Filas reativadas com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
