/**
 * SCRIPT DE EMERGÊNCIA - Pausar todas as filas de voz
 * 
 * Para todos os envios de mensagens WhatsApp e ligações
 * 
 * Uso: tsx scripts/emergency-pause-queues.ts
 */

import { Queue } from 'bullmq';
import { redisConnection } from '../server/lib/redis-config';

async function emergencyPauseQueues() {
  console.log('🚨 EMERGÊNCIA: Pausando todas as filas de voz...\n');

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
      
      // Pausar fila
      await queue.pause();
      console.log(`✅ Fila pausada: ${queueName}`);
      
      // Mostrar estatísticas
      const waiting = await queue.getWaiting();
      const delayed = await queue.getDelayed();
      const active = await queue.getActive();
      
      console.log(`   - Waiting: ${waiting.length}`);
      console.log(`   - Delayed: ${delayed.length}`);
      console.log(`   - Active: ${active.length}`);
      console.log('');
      
      await queue.close();
    } catch (error: any) {
      console.error(`❌ Erro ao pausar fila ${queueName}:`, error.message);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('🛑 TODAS AS FILAS FORAM PAUSADAS');
  console.log('═══════════════════════════════════════════════════');
  console.log('\n⚠️  Para reativar, execute: tsx scripts/unpause-queues.ts');
}

emergencyPauseQueues()
  .then(() => {
    console.log('\n✅ Operação de emergência concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
